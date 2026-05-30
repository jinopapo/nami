/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_repository'. Dependency is of type 'electron_repository' */
import { describe, expect, it, vi } from 'vitest';
import type { ToolPermissionRequest } from '../entity/clineSession.js';
import {
  buildResolveProcessPathShellArgs,
  ClineSdkAgentRepository,
  resolveClineSdkShell,
} from './clineSdkAgentRepository.js';

type CoreEvent = Parameters<
  Parameters<ClineSdkAgentRepository['subscribe']>[0]
>[0];

type CoreOptions = {
  capabilities?: {
    requestToolApproval?: (request: {
      sessionId: string;
      toolName: string;
      input: unknown;
    }) => Promise<{ approved: boolean; reason?: string }>;
  };
};

type CoreStartInput = {
  interactive?: boolean;
  capabilities?: CoreOptions['capabilities'];
};

const rawToolApprovalRequest = {
  sessionId: 'session-1',
  toolName: 'bash',
  input: { command: 'npm test' },
};

const permissionRequest: ToolPermissionRequest = {
  ...rawToolApprovalRequest,
  title: 'bash の実行許可',
  options: [
    { optionId: 'allow_once', kind: 'allow', name: '許可' },
    { optionId: 'reject_once', kind: 'reject', name: '拒否' },
  ],
};

const createRepository = () => {
  const coreListeners: Array<(event: unknown) => void> = [];
  const core = {
    start: vi.fn(async (_input: unknown) => ({
      sessionId: 'session-1',
      result: { finishReason: 'completed' },
    })),
    send: vi.fn(async () => ({ finishReason: 'aborted' })),
    abort: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined),
    subscribe: vi.fn((listener: (event: unknown) => void) => {
      coreListeners.push(listener);
      return vi.fn();
    }),
  };
  const createOptionsRef: { current?: CoreOptions } = {};
  const createCore = vi.fn(async (options: unknown) => {
    createOptionsRef.current = options as CoreOptions;
    return core;
  });
  const repository = new ClineSdkAgentRepository(createCore);

  return { repository, core, coreListeners, createCore, createOptionsRef };
};

describe('ClineSdkAgentRepository', () => {
  it('uses SHELL from the environment when available', () => {
    expect(resolveClineSdkShell({ SHELL: '/opt/homebrew/bin/fish' })).toBe(
      '/opt/homebrew/bin/fish',
    );
  });

  it('falls back to the platform default shell when SHELL is missing', () => {
    expect(resolveClineSdkShell({})).toBe(
      process.platform === 'darwin' ? '/bin/zsh' : '/bin/sh',
    );
  });

  it('builds login shell args that resolve PATH', () => {
    expect(buildResolveProcessPathShellArgs()).toEqual([
      '-l',
      '-c',
      'printf %s "$PATH"',
    ]);
  });

  it('creates ClineCore once and subscribes to core events', async () => {
    const originalPath = process.env.PATH;
    const { repository, core, createCore, createOptionsRef } =
      createRepository();
    const requestToolApproval = vi.fn(async () => ({ approved: true }));

    const resolveProcessPath = vi.fn(async () => '/opt/homebrew/bin:/usr/bin');
    const repositoryWithResolvedPath = new ClineSdkAgentRepository(
      createCore,
      resolveProcessPath,
    );

    await repositoryWithResolvedPath.initialize({ requestToolApproval });
    await repositoryWithResolvedPath.initialize({ requestToolApproval });

    expect(createCore).toHaveBeenCalledTimes(1);
    expect(resolveProcessPath).toHaveBeenCalledTimes(1);
    expect(process.env.PATH).toBe('/opt/homebrew/bin:/usr/bin');
    expect(createCore).toHaveBeenCalledWith(
      expect.objectContaining({
        clientName: 'nami',
        backendMode: 'local',
        capabilities: { requestToolApproval: expect.any(Function) },
        toolPolicies: expect.objectContaining({
          bash: { enabled: true, autoApprove: false },
          read_files: { enabled: true, autoApprove: true },
        }),
      }),
    );
    await expect(
      createOptionsRef.current?.capabilities?.requestToolApproval?.(
        rawToolApprovalRequest,
      ),
    ).resolves.toEqual({ approved: true });
    expect(requestToolApproval).toHaveBeenCalledWith(permissionRequest);
    expect(core.subscribe).toHaveBeenCalledTimes(1);

    process.env.PATH = originalPath;
    void repository;
  });

  it('continues initialization when login shell PATH resolution fails', async () => {
    const { createCore } = createRepository();
    const repository = new ClineSdkAgentRepository(
      createCore,
      vi.fn(async () => undefined),
    );

    await repository.initialize({
      requestToolApproval: vi.fn(async () => ({ approved: true })),
    });

    expect(createCore).toHaveBeenCalledTimes(1);
  });

  it('starts, sends, aborts and disposes through ClineCore', async () => {
    const { repository, core } = createRepository();
    const requestToolApproval = vi.fn(async () => ({ approved: true }));
    await repository.initialize({ requestToolApproval });

    await expect(
      repository.start({
        prompt: 'hello',
        interactive: true,
        config: {
          providerId: 'anthropic',
          modelId: 'claude-sonnet-4',
          cwd: '/repo',
          enableTools: true,
          sessionId: 'session-1',
          mode: 'plan',
          systemPrompt: 'system',
          enableSpawnAgent: false,
          enableAgentTeams: false,
          workspaceRoot: '/repo',
        },
        requestToolApproval,
      }),
    ).resolves.toEqual({ sessionId: 'session-1', stopReason: 'completed' });
    await expect(
      repository.send({ sessionId: 'session-1', prompt: 'next', mode: 'act' }),
    ).resolves.toEqual({ stopReason: 'cancelled' });
    await repository.abort({
      sessionId: 'session-1',
      reason: 'User cancelled',
    });
    await repository.dispose();

    expect(core.start).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'hello',
        interactive: true,
        capabilities: { requestToolApproval: expect.any(Function) },
      }),
    );
    const startInput = core.start.mock.calls[0]?.[0] as CoreStartInput;
    await expect(
      startInput.capabilities?.requestToolApproval?.(rawToolApprovalRequest),
    ).resolves.toEqual({ approved: true });
    expect(requestToolApproval).toHaveBeenCalledWith(permissionRequest);
    expect(core.send).toHaveBeenCalledWith({
      sessionId: 'session-1',
      prompt: 'next',
      mode: 'act',
    });
    expect(core.abort).toHaveBeenCalledWith('session-1', 'User cancelled');
    expect(core.dispose).toHaveBeenCalledWith('nami shutdown');
  });

  it('maps core session events before publishing them', async () => {
    const { repository, coreListeners } = createRepository();
    const received: CoreEvent[] = [];
    repository.subscribe((event) => received.push(event));
    await repository.initialize({ requestToolApproval: vi.fn() });

    coreListeners[0]?.({
      type: 'chunk',
      payload: {
        sessionId: 'session-1',
        stream: 'agent',
        chunk: 'hello',
        ts: 1,
      },
    });

    expect(received).toEqual([
      {
        sessionId: 'session-1',
        type: 'session-update',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'hello' },
          text: 'hello',
        },
      },
    ]);
  });

  it('publishes all mapped events when a core event expands to multiple session events', async () => {
    const { repository, coreListeners } = createRepository();
    const received: CoreEvent[] = [];
    repository.subscribe((event) => received.push(event));
    await repository.initialize({ requestToolApproval: vi.fn() });

    coreListeners[0]?.({
      type: 'chunk',
      payload: {
        sessionId: 'session-1',
        stream: 'agent',
        chunk: [
          JSON.stringify({
            type: 'content_start',
            contentType: 'text',
            text: '調べます',
          }),
          JSON.stringify({
            type: 'content_start',
            contentType: 'tool',
            toolCallId: 'tool-1',
            toolName: 'read_files',
            input: {
              files: [
                { path: '/workspace/README.md', start_line: 1, end_line: 1 },
              ],
            },
          }),
        ].join('\n'),
        ts: 1,
      },
    });

    expect(received).toEqual([
      expect.objectContaining({
        sessionId: 'session-1',
        type: 'session-update',
        update: expect.objectContaining({
          sessionUpdate: 'agent_message_chunk',
          text: '調べます',
        }),
      }),
      expect.objectContaining({
        sessionId: 'session-1',
        type: 'session-update',
        update: expect.objectContaining({
          sessionUpdate: 'tool_call',
          toolCallId: 'tool-1',
          title: 'read_files',
        }),
      }),
    ]);
  });
});
