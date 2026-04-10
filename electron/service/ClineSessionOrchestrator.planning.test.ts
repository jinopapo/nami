import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACP_EVENT_COUNT,
  agentInstances,
  ClineAgentMock,
  createUserDataPath,
  resetClineTestState,
  waitUntil,
  waitForAsyncWork,
} from './ClineSessionService.testHelper.js';
import { ClineSessionOrchestrator } from '../ipc/clineSessionOrchestrator.js';

describe('ClineSessionOrchestrator planning flow', () => {
  const originalClineDir = process.env.CLINE_DIR;

  afterEach(() => {
    resetClineTestState(originalClineDir);
  });

  it('constructs ClineAgent with the resolved shared clineDir', () => {
    process.env.CLINE_DIR = '/tmp/shared-cline';
    vi.spyOn(os, 'homedir').mockReturnValue('/Users/tester');

    new ClineSessionOrchestrator('/tmp/nami-user-data');

    expect(ClineAgentMock).toHaveBeenCalledWith({
      clineDir: path.join('/Users/tester', '.cline'),
      debug: false,
    });
    expect(agentInstances[0]?.setPermissionHandler).toHaveBeenCalledTimes(1);
  });

  it('creates a fresh task in before_start without sending the prompt yet', async () => {
    const userDataPath = await createUserDataPath('send-message');
    const service = new ClineSessionOrchestrator(userDataPath);

    const task = await service.startTask({ cwd: '/tmp', prompt: 'hello' });

    expect(agentInstances[0]?.newSession).toHaveBeenCalledTimes(1);
    expect(agentInstances[0]?.setSessionMode).not.toHaveBeenCalled();
    expect(agentInstances[0]?.prompt).not.toHaveBeenCalled();
    expect(task.sessionId).toBe('new-session');
    expect(task.taskId).toBeTruthy();
    expect(task.lifecycleState).toBe('before_start');
    expect(task.runtimeState).toBe('idle');
  });

  it('does not call setSessionMode on startTask when the session is already in plan mode', async () => {
    const userDataPath = await createUserDataPath('start-skip-plan-mode');
    const service = new ClineSessionOrchestrator(userDataPath);

    await service.startTask({ cwd: '/tmp', prompt: 'hello' });

    expect(agentInstances[0]?.setSessionMode).not.toHaveBeenCalled();
  });

  it('does not attach duplicate listeners when the same session is reused', async () => {
    const userDataPath = await createUserDataPath('duplicate-listeners');
    const service = new ClineSessionOrchestrator(userDataPath);

    await service.startTask({ cwd: '/tmp', prompt: 'hello' });

    const emitter = agentInstances[0]?.emitterForSession.mock.results[0]
      ?.value as { on: ReturnType<typeof vi.fn> };
    expect(agentInstances[0]?.emitterForSession).toHaveBeenCalledTimes(1);
    expect(emitter.on).toHaveBeenCalledTimes(ACP_EVENT_COUNT + 1);
  });

  it('moves to awaiting_confirmation only when a planning turn stops with end_turn', async () => {
    const userDataPath = await createUserDataPath('plan-end-turn');
    const service = new ClineSessionOrchestrator(userDataPath);
    const events: Array<
      Parameters<Parameters<typeof service.subscribe>[0]>[0]
    > = [];
    service.subscribe((event) => {
      events.push(event);
    });
    agentInstances[0]?.prompt.mockResolvedValueOnce({ stopReason: 'end_turn' });

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitUntil(() => {
      const lifecycleEvents = events.filter(
        (event) => event.type === 'task-lifecycle-state-changed',
      );
      expect(lifecycleEvents).toContainEqual(
        expect.objectContaining({
          type: 'task-lifecycle-state-changed',
          taskId: task.taskId,
          state: 'awaiting_confirmation',
          mode: 'plan',
          reason: 'end_turn',
        }),
      );
    });
  });

  it('moves to awaiting_confirmation when a planning turn stops with completed', async () => {
    const userDataPath = await createUserDataPath(
      'plan-completed-awaiting-confirmation',
    );
    const service = new ClineSessionOrchestrator(userDataPath);
    const events: Array<
      Parameters<Parameters<typeof service.subscribe>[0]>[0]
    > = [];
    service.subscribe((event) => {
      events.push(event);
    });
    agentInstances[0]?.prompt.mockResolvedValueOnce({
      stopReason: 'completed',
    });

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitUntil(() => {
      const lifecycleEvents = events.filter(
        (event) => event.type === 'task-lifecycle-state-changed',
      );
      expect(lifecycleEvents).toContainEqual(
        expect.objectContaining({
          type: 'task-lifecycle-state-changed',
          taskId: task.taskId,
          state: 'awaiting_confirmation',
          mode: 'plan',
          reason: 'completed',
        }),
      );
    });
  });

  it('keeps plan mode when current_mode_update switches to act during planning', async () => {
    const userDataPath = await createUserDataPath(
      'plan-mode-update-awaiting-confirmation',
    );
    const service = new ClineSessionOrchestrator(userDataPath);
    const events: Array<
      Parameters<Parameters<typeof service.subscribe>[0]>[0]
    > = [];
    service.subscribe((event) => {
      events.push(event);
    });
    let resolvePrompt:
      | ((value: { stopReason: 'completed' }) => void)
      | undefined;
    agentInstances[0]?.prompt.mockImplementationOnce(
      () =>
        new Promise<{ stopReason: 'completed' }>((resolve) => {
          resolvePrompt = resolve;
        }),
    );

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitUntil(() => {
      expect(resolvePrompt).toBeTypeOf('function');
    });
    const emitter = agentInstances[0]?.emitterForSession.mock.results[0]
      ?.value as { on: ReturnType<typeof vi.fn> };
    const currentModeCall = emitter.on.mock.calls.find(
      (call) => call[0] === 'current_mode_update',
    );
    const currentModeListener = currentModeCall?.[1] as
      | ((update: unknown) => void)
      | undefined;

    currentModeListener?.({ currentModeId: 'act' });
    resolvePrompt?.({ stopReason: 'completed' });
    await waitUntil(() => {
      const lifecycleEvents = events.filter(
        (event) => event.type === 'task-lifecycle-state-changed',
      );
      expect(lifecycleEvents).toContainEqual(
        expect.objectContaining({
          type: 'task-lifecycle-state-changed',
          taskId: task.taskId,
          state: 'awaiting_confirmation',
          mode: 'plan',
          reason: 'completed',
        }),
      );
    });
    expect(agentInstances[0]?.setSessionMode).not.toHaveBeenCalled();
  });

  it('does not move to awaiting_confirmation when a planning turn stops for an unsupported reason', async () => {
    const userDataPath = await createUserDataPath('plan-completed');
    const service = new ClineSessionOrchestrator(userDataPath);
    const events: Array<
      Parameters<Parameters<typeof service.subscribe>[0]>[0]
    > = [];
    service.subscribe((event) => {
      events.push(event);
    });
    agentInstances[0]?.prompt.mockResolvedValueOnce({
      stopReason: 'cancelled',
    });

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitForAsyncWork();

    const lifecycleEvents = events.filter(
      (event) =>
        event.type === 'task-lifecycle-state-changed' &&
        event.reason !== 'start_planning',
    );
    expect(lifecycleEvents).toEqual([]);
  });

  it('keeps planning when a planning turn is stopped', async () => {
    const userDataPath = await createUserDataPath('plan-cancelled');
    const service = new ClineSessionOrchestrator(userDataPath);
    const events: Array<
      Parameters<Parameters<typeof service.subscribe>[0]>[0]
    > = [];
    service.subscribe((event) => {
      events.push(event);
    });
    agentInstances[0]?.prompt.mockResolvedValueOnce({
      stopReason: 'cancelled',
    });

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitForAsyncWork();

    const lifecycleEvents = events.filter(
      (event) =>
        event.type === 'task-lifecycle-state-changed' &&
        event.reason !== 'start_planning',
    );
    expect(lifecycleEvents).toEqual([]);

    const runtimeEvents = events.filter(
      (event) => event.type === 'chat-runtime-state-changed',
    );
    expect(runtimeEvents).toContainEqual(
      expect.objectContaining({
        type: 'chat-runtime-state-changed',
        taskId: task.taskId,
        state: 'running',
        reason: 'prompt_started',
      }),
    );
  });
});
