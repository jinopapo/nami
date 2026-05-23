/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_service' */
import { describe, expect, it, vi } from 'vitest';
import type {
  SessionEvent,
  ToolPermissionRequest,
} from '../entity/clineSession.js';
import { ClineSdkAgentService } from './ClineSdkAgentService.js';

type RepositoryInitializeInput = {
  requestToolApproval: (
    request: ToolPermissionRequest,
  ) => Promise<{ approved: boolean; reason?: string }>;
};

type RepositoryEvent = SessionEvent & { sessionId: string };

type RepositoryStartInput = {
  prompt: string;
  interactive?: boolean;
  config: {
    sessionId: string;
    mode: 'plan' | 'act';
    cwd: string;
    enableTools: true;
    systemPrompt: string;
  };
  requestToolApproval: (
    request: ToolPermissionRequest,
  ) => Promise<{ approved: boolean; reason?: string }>;
};

const permissionRequest: ToolPermissionRequest = {
  sessionId: 'session-1',
  toolName: 'bash',
  input: { command: 'npm test' },
  title: 'bash の実行許可',
  options: [
    { optionId: 'allow_once', kind: 'allow', name: '許可' },
    { optionId: 'reject_once', kind: 'reject', name: '拒否' },
  ],
};

const createService = () => {
  const configService = {
    createCoreSessionConfig: vi.fn(async (cwd: string) => ({
      providerId: 'anthropic' as const,
      modelId: 'claude-sonnet-4',
      apiKey: 'secret',
      cwd,
      enableTools: true as const,
    })),
  };
  const listeners: Array<(event: RepositoryEvent) => void> = [];
  const initializeInputRef: { current?: RepositoryInitializeInput } = {};
  const repository = {
    initialize: vi.fn(async (input: RepositoryInitializeInput) => {
      initializeInputRef.current = input;
    }),
    start: vi.fn(async (input: RepositoryStartInput) => ({
      sessionId: input.config.sessionId,
      stopReason: 'completed',
    })),
    send: vi.fn(async () => ({ stopReason: 'completed' })),
    abort: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined),
    subscribe: vi.fn((listener: (event: RepositoryEvent) => void) => {
      listeners.push(listener);
      return vi.fn();
    }),
  };
  const service = new ClineSdkAgentService(configService, repository);

  return {
    service,
    configService,
    repository,
    listeners,
    initializeInputRef,
  };
};

describe('ClineSdkAgentService', () => {
  it('initializes repository and subscribes to events once', async () => {
    const { service, repository } = createService();

    await service.initialize();
    await service.initialize();

    expect(repository.initialize).toHaveBeenCalledTimes(2);
    expect(repository.subscribe).toHaveBeenCalledTimes(1);
  });

  it('creates interactive SDK session and sends first prompt', async () => {
    const { service, configService, repository } = createService();
    const { sessionId } = await service.newSession({ cwd: '/repo' });

    await expect(
      service.prompt({ sessionId, prompt: 'hello' }),
    ).resolves.toEqual({ stopReason: 'completed' });

    expect(configService.createCoreSessionConfig).toHaveBeenCalledWith('/repo');
    expect(repository.start).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: '',
        interactive: true,
        config: expect.objectContaining({
          sessionId,
          mode: 'plan',
          cwd: '/repo',
          enableTools: true,
          systemPrompt: expect.any(String),
        }),
      }),
    );
    expect(repository.send).toHaveBeenCalledWith({
      sessionId,
      prompt: 'hello',
      mode: 'plan',
    });
  });

  it('sends follow-up prompt to the same interactive session', async () => {
    const { service, repository } = createService();
    const { sessionId } = await service.newSession({ cwd: '/repo' });

    await service.prompt({ sessionId, prompt: 'first' });
    await service.setSessionMode({ sessionId, modeId: 'act' });
    await service.prompt({ sessionId, prompt: 'second' });

    expect(repository.start).toHaveBeenCalledTimes(1);
    expect(repository.send).toHaveBeenLastCalledWith({
      sessionId,
      prompt: 'second',
      mode: 'act',
    });
  });

  it('sends follow-up prompt with SDK session id returned by first start', async () => {
    const { service, repository } = createService();
    repository.start.mockResolvedValueOnce({
      sessionId: 'sdk-session-1',
      stopReason: 'completed',
    });
    const { sessionId } = await service.newSession({ cwd: '/repo' });

    await service.prompt({ sessionId, prompt: 'first' });
    await service.setSessionMode({ sessionId, modeId: 'act' });
    await service.prompt({ sessionId, prompt: 'second' });

    expect(repository.send).toHaveBeenCalledWith({
      sessionId: 'sdk-session-1',
      prompt: 'second',
      mode: 'act',
    });
  });

  it('publishes SDK session events to public session subscribers', async () => {
    const { service, repository, listeners } = createService();
    repository.start.mockResolvedValueOnce({
      sessionId: 'sdk-session-1',
      stopReason: 'completed',
    });
    const { sessionId } = await service.newSession({ cwd: '/repo' });
    const received: unknown[] = [];
    service.subscribeSession(sessionId, (event) => received.push(event));

    await service.prompt({ sessionId, prompt: 'first' });
    listeners[0]?.({
      sessionId: 'sdk-session-1',
      type: 'session-update',
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'hello' },
        text: 'hello',
      },
    });

    expect(received).toEqual([
      {
        type: 'session-update',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'hello' },
          text: 'hello',
        },
      },
    ]);
  });

  it('normalizes SDK permission request session id to public session id', async () => {
    const context = createService();
    const { service, repository } = context;
    const handler = vi.fn(async () => ({ approved: true }));
    service.setPermissionHandler(handler);
    repository.start.mockResolvedValueOnce({
      sessionId: 'sdk-session-1',
      stopReason: 'completed',
    });
    const { sessionId } = await service.newSession({ cwd: '/repo' });

    await service.prompt({ sessionId, prompt: 'hello' });
    const startInput = repository.start.mock.calls[0]?.[0] as
      | RepositoryStartInput
      | undefined;
    const response = await startInput?.requestToolApproval({
      ...permissionRequest,
      sessionId: 'sdk-session-1',
    });

    expect(response).toEqual({ approved: true });
    expect(handler).toHaveBeenCalledWith({
      ...permissionRequest,
      sessionId,
    });
  });

  it('publishes current mode update when session mode changes', async () => {
    const { service } = createService();
    const { sessionId } = await service.newSession({ cwd: '/repo' });
    const received: unknown[] = [];
    service.subscribeSession(sessionId, (event) => received.push(event));

    await service.setSessionMode({ sessionId, modeId: 'act' });

    expect(received).toEqual([
      {
        type: 'session-update',
        update: {
          sessionUpdate: 'current_mode_update',
          currentModeId: 'act',
        },
      },
    ]);
  });

  it('aborts and disposes core', async () => {
    const { service, repository } = createService();
    const { sessionId } = await service.newSession({ cwd: '/repo' });

    await service.cancel({ sessionId });
    await service.dispose();

    expect(repository.abort).toHaveBeenCalledWith({
      sessionId,
      reason: 'User cancelled',
    });
    expect(repository.dispose).toHaveBeenCalledTimes(1);
  });

  it('bridges permission approval requests', async () => {
    const context = createService();
    const { service } = context;
    const handler = vi.fn(async () => ({ approved: true }));
    service.setPermissionHandler(handler);

    await service.initialize();
    const response =
      await context.initializeInputRef.current?.requestToolApproval(
        permissionRequest,
      );

    expect(response).toEqual({ approved: true });
    expect(handler).toHaveBeenCalledWith(permissionRequest);
  });

  it('bridges first prompt permission approval requests', async () => {
    const { service, repository } = createService();
    const handler = vi.fn(async () => ({ approved: true }));
    service.setPermissionHandler(handler);
    const { sessionId } = await service.newSession({ cwd: '/repo' });

    await service.prompt({ sessionId, prompt: 'hello' });
    const startInput = repository.start.mock.calls[0]?.[0] as
      | RepositoryStartInput
      | undefined;
    const response = await startInput?.requestToolApproval(permissionRequest);

    expect(response).toEqual({ approved: true });
    expect(handler).toHaveBeenCalledWith(permissionRequest);
  });

  it('publishes mapped session events to session subscribers', async () => {
    const { service, listeners } = createService();
    const { sessionId } = await service.newSession({ cwd: '/repo' });
    const received: unknown[] = [];
    service.subscribeSession(sessionId, (event) => received.push(event));
    await service.initialize();

    listeners[0]?.({
      sessionId,
      type: 'session-update',
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'hello' },
        text: 'hello',
      },
    });

    expect(received).toEqual([
      {
        type: 'session-update',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'hello' },
          text: 'hello',
        },
      },
    ]);
  });
});
