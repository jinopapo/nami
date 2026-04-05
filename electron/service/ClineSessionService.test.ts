import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { agentInstances, ClineAgentMock } = vi.hoisted(() => {
  const instances: Array<{
    sessions: Map<string, {
      sessionId: string;
      cwd: string;
      mode: 'plan' | 'act';
      mcpServers: [];
      createdAt: number;
      lastActivityAt: number;
    }>;
    setPermissionHandler: ReturnType<typeof vi.fn>;
    initialize: ReturnType<typeof vi.fn>;
    newSession: ReturnType<typeof vi.fn>;
    prompt: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    setSessionMode: ReturnType<typeof vi.fn>;
    emitterForSession: ReturnType<typeof vi.fn>;
  }> = [];
  const mock = vi.fn(
    class {
      sessions = new Map();
      setPermissionHandler = vi.fn();
      initialize = vi.fn();
      newSession = vi.fn();
      prompt = vi.fn();
      cancel = vi.fn();
      setSessionMode = vi.fn();
      emitterForSession = vi.fn();

      constructor() {
        const emitter = { on: vi.fn() };
        this.emitterForSession.mockReturnValue(emitter);
        this.newSession.mockImplementation(async ({ cwd }: { cwd: string }) => {
          const session = {
            sessionId: 'new-session',
            cwd,
            mode: 'plan' as const,
            mcpServers: [],
            createdAt: Date.parse('2026-03-19T00:00:00.000Z'),
            lastActivityAt: Date.parse('2026-03-19T00:00:00.000Z'),
          };
          this.sessions.set(session.sessionId, session);
          return { sessionId: session.sessionId, modes: { currentModeId: 'plan' } };
        });
        this.prompt.mockResolvedValue({ stopReason: 'completed' });
        this.setSessionMode.mockImplementation(async ({ sessionId, modeId }: { sessionId: string; modeId: 'plan' | 'act' }) => {
          const session = this.sessions.get(sessionId);
          if (session) {
            session.mode = modeId;
          }
          return {};
        });
        instances.push(this);
      }
    },
  );

  return {
    agentInstances: instances,
    ClineAgentMock: mock,
  };
});

vi.mock('cline', () => ({
  ClineAgent: ClineAgentMock,
}));

import { ClineSessionService, resolveClineDir } from './ClineSessionService.js';

const createUserDataPath = async (name: string) => fs.mkdtemp(path.join(os.tmpdir(), `nami-${name}-`));

const addMockSession = (sessionId: string, cwd = '/tmp') => {
  agentInstances[0]?.sessions.set(sessionId, {
    sessionId,
    cwd,
    mode: 'plan',
    mcpServers: [],
    createdAt: Date.parse('2026-03-19T00:00:00.000Z'),
    lastActivityAt: Date.parse('2026-03-19T00:00:00.000Z'),
  });
};

describe('resolveClineDir', () => {
  afterEach(() => {
    agentInstances.length = 0;
    ClineAgentMock.mockClear();
    vi.restoreAllMocks();
  });

  it('always resolves to ~/.cline', () => {
    vi.spyOn(os, 'homedir').mockReturnValue('/Users/tester');

    expect(resolveClineDir()).toBe(path.join('/Users/tester', '.cline'));
  });

  it('ignores CLINE_DIR when it is set', () => {
    process.env.CLINE_DIR = '/tmp/shared-cline';
    vi.spyOn(os, 'homedir').mockReturnValue('/Users/tester');

    expect(resolveClineDir()).toBe(path.join('/Users/tester', '.cline'));
  });
});

describe('ClineSessionService', () => {
  const originalClineDir = process.env.CLINE_DIR;

  afterEach(() => {
    agentInstances.length = 0;
    ClineAgentMock.mockClear();
    process.env.CLINE_DIR = originalClineDir;
    vi.restoreAllMocks();
  });

  it('constructs ClineAgent with the resolved shared clineDir', () => {
    process.env.CLINE_DIR = '/tmp/shared-cline';
    vi.spyOn(os, 'homedir').mockReturnValue('/Users/tester');

    new ClineSessionService('/tmp/nami-user-data');

    expect(ClineAgentMock).toHaveBeenCalledWith({
      clineDir: path.join('/Users/tester', '.cline'),
      debug: false,
    });
    expect(agentInstances[0]?.setPermissionHandler).toHaveBeenCalledTimes(1);
  });

  it('creates a fresh task and sends the prompt there', async () => {
    const userDataPath = await createUserDataPath('send-message');
    const service = new ClineSessionService(userDataPath);
    agentInstances[0]?.prompt.mockImplementation(() => new Promise(() => {}));

    const task = await service.startTask({ cwd: '/tmp', prompt: 'hello' });

    expect(agentInstances[0]?.newSession).toHaveBeenCalledTimes(1);
    expect(agentInstances[0]?.prompt).toHaveBeenCalledWith({
      sessionId: 'new-session',
      prompt: [{ type: 'text', text: 'hello' }],
    });
    expect(task.sessionId).toBe('new-session');
    expect(task.taskId).toBeTruthy();
    expect(task.lifecycleState).toBe('planning');
  });

  it('does not attach duplicate listeners when the same session is reused', async () => {
    const userDataPath = await createUserDataPath('duplicate-listeners');
    const service = new ClineSessionService(userDataPath);

    await service.startTask({ cwd: '/tmp', prompt: 'hello' });

    const emitter = agentInstances[0]?.emitterForSession.mock.results[0]?.value as { on: ReturnType<typeof vi.fn> };
    expect(agentInstances[0]?.emitterForSession).toHaveBeenCalledTimes(1);
    expect(emitter.on).toHaveBeenCalledTimes(ACP_EVENT_COUNT + 1);
  });

  it('moves to awaiting_confirmation only when a planning turn stops with end_turn', async () => {
    const userDataPath = await createUserDataPath('plan-end-turn');
    const service = new ClineSessionService(userDataPath);
    const events: Array<Parameters<Parameters<typeof service.subscribe>[0]>[0]> = [];
    service.subscribe((event) => {
      events.push(event);
    });
    agentInstances[0]?.prompt.mockResolvedValueOnce({ stopReason: 'end_turn' });

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    await Promise.resolve();

    const lifecycleEvents = events.filter((event) => event.type === 'task-lifecycle-state-changed');
    expect(lifecycleEvents).toContainEqual(expect.objectContaining({
      type: 'task-lifecycle-state-changed',
      taskId: task.taskId,
      state: 'awaiting_confirmation',
      mode: 'plan',
      reason: 'end_turn',
    }));
  });

  it('moves to awaiting_confirmation when a planning turn stops with completed', async () => {
    const userDataPath = await createUserDataPath('plan-completed-awaiting-confirmation');
    const service = new ClineSessionService(userDataPath);
    const events: Array<Parameters<Parameters<typeof service.subscribe>[0]>[0]> = [];
    service.subscribe((event) => {
      events.push(event);
    });
    agentInstances[0]?.prompt.mockResolvedValueOnce({ stopReason: 'completed' });

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    await Promise.resolve();

    const lifecycleEvents = events.filter((event) => event.type === 'task-lifecycle-state-changed');
    expect(lifecycleEvents).toContainEqual(expect.objectContaining({
      type: 'task-lifecycle-state-changed',
      taskId: task.taskId,
      state: 'awaiting_confirmation',
      mode: 'plan',
      reason: 'completed',
    }));
  });

  it('does not move to awaiting_confirmation when a planning turn stops for an unsupported reason', async () => {
    const userDataPath = await createUserDataPath('plan-completed');
    const service = new ClineSessionService(userDataPath);
    const events: Array<Parameters<Parameters<typeof service.subscribe>[0]>[0]> = [];
    service.subscribe((event) => {
      events.push(event);
    });
    agentInstances[0]?.prompt.mockResolvedValueOnce({ stopReason: 'cancelled' });

    await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    await Promise.resolve();

    const lifecycleEvents = events.filter((event) => event.type === 'task-lifecycle-state-changed');
    expect(lifecycleEvents).toEqual([]);
  });

  it('moves to awaiting_review only when an execution turn stops with end_turn', async () => {
    const userDataPath = await createUserDataPath('act-end-turn-awaiting-review');
    const service = new ClineSessionService(userDataPath);
    const events: Array<Parameters<Parameters<typeof service.subscribe>[0]>[0]> = [];
    service.subscribe((event) => {
      events.push(event);
    });
    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'end_turn' })
      .mockResolvedValueOnce({ stopReason: 'end_turn' });

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    await Promise.resolve();

    service.transitionTaskLifecycle({ taskId: task.taskId, nextState: 'executing' });
    await Promise.resolve();
    await Promise.resolve();

    const lifecycleEvents = events.filter((event) => event.type === 'task-lifecycle-state-changed');
    expect(lifecycleEvents).toContainEqual(expect.objectContaining({
      type: 'task-lifecycle-state-changed',
      taskId: task.taskId,
      state: 'awaiting_review',
      mode: 'act',
      reason: 'end_turn',
    }));
  });

  it('restarts in plan mode when transitioning from awaiting_confirmation to planning', async () => {
    const userDataPath = await createUserDataPath('resume-planning');
    const service = new ClineSessionService(userDataPath);
    const events: Array<Parameters<Parameters<typeof service.subscribe>[0]>[0]> = [];
    service.subscribe((event) => {
      events.push(event);
    });
    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'end_turn' })
      .mockImplementationOnce(() => new Promise(() => {}));

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    await Promise.resolve();

    service.transitionTaskLifecycle({ taskId: task.taskId, nextState: 'planning' });
    await Promise.resolve();

    expect(agentInstances[0]?.prompt).toHaveBeenNthCalledWith(2, {
      sessionId: 'new-session',
      prompt: [{ type: 'text', text: '前回の計画を踏まえて、計画を練り直してください。' }],
    });
    expect(events).toContainEqual(expect.objectContaining({
      type: 'task-lifecycle-state-changed',
      taskId: task.taskId,
      state: 'planning',
      mode: 'plan',
      reason: 'retry_planning',
    }));
  });

  it('switches to act mode and starts execution when transitioning from awaiting_confirmation to executing', async () => {
    const userDataPath = await createUserDataPath('start-executing');
    const service = new ClineSessionService(userDataPath);
    const events: Array<Parameters<Parameters<typeof service.subscribe>[0]>[0]> = [];
    service.subscribe((event) => {
      events.push(event);
    });
    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'end_turn' })
      .mockImplementationOnce(() => new Promise(() => {}));

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    await Promise.resolve();

    service.transitionTaskLifecycle({ taskId: task.taskId, nextState: 'executing' });
    await Promise.resolve();

    expect(agentInstances[0]?.setSessionMode).toHaveBeenCalledWith({ sessionId: 'new-session', modeId: 'act' });
    expect(agentInstances[0]?.prompt).toHaveBeenNthCalledWith(2, {
      sessionId: 'new-session',
      prompt: [{ type: 'text', text: 'これまでの計画を踏まえて、actモードとして実行を開始してください。' }],
    });
    expect(events).toContainEqual(expect.objectContaining({
      type: 'task-lifecycle-state-changed',
      taskId: task.taskId,
      state: 'executing',
      mode: 'act',
      reason: 'start_execution',
    }));
  });

  it('switches back to plan mode before restarting planning', async () => {
    const userDataPath = await createUserDataPath('restart-planning-mode-sync');
    const service = new ClineSessionService(userDataPath);
    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'end_turn' })
      .mockImplementationOnce(() => new Promise(() => {}));

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    await Promise.resolve();

    service.transitionTaskLifecycle({ taskId: task.taskId, nextState: 'planning' });

    expect(agentInstances[0]?.setSessionMode).toHaveBeenCalledWith({ sessionId: 'new-session', modeId: 'plan' });
  });

  it('updates task mode when current_mode_update event is emitted', async () => {
    const userDataPath = await createUserDataPath('current-mode-update');
    const service = new ClineSessionService(userDataPath);
    const events: Array<Parameters<Parameters<typeof service.subscribe>[0]>[0]> = [];
    service.subscribe((event) => {
      events.push(event);
    });
    agentInstances[0]?.prompt.mockImplementation(() => new Promise(() => {}));

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    const emitter = agentInstances[0]?.emitterForSession.mock.results[0]?.value as { on: ReturnType<typeof vi.fn> };
    const currentModeCall = emitter.on.mock.calls.find((call) => call[0] === 'current_mode_update');
    const currentModeListener = currentModeCall?.[1] as ((update: unknown) => void) | undefined;

    currentModeListener?.({ currentModeId: 'act' });

    const lifecycleEvents = events.filter((event) => event.type === 'session-update');
    expect(lifecycleEvents).toContainEqual(expect.objectContaining({
      type: 'session-update',
      taskId: task.taskId,
      sessionId: task.sessionId,
      update: expect.objectContaining({ sessionUpdate: 'current_mode_update', currentModeId: 'act' }),
    }));

    service.transitionTaskLifecycle({ taskId: task.taskId, nextState: 'awaiting_confirmation' });
    const modeEvent = events.find((event) => event.type === 'task-lifecycle-state-changed' && event.state === 'awaiting_confirmation');
    expect(modeEvent).toEqual(expect.objectContaining({ mode: 'act' }));
  });
});

const ACP_EVENT_COUNT = 10;
