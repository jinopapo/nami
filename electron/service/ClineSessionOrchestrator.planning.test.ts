/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_service' | No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_ipc' */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  agentInstances,
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

  it('restores plan mode when current_mode_update switches to act during planning', async () => {
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
    const emitter = agentInstances[0]?.emitterForSession.mock.results[1]
      ?.value as { on: ReturnType<typeof vi.fn> };
    const currentModeCall = [...emitter.on.mock.calls]
      .reverse()
      .find((call) => call[0] === 'current_mode_update');
    const currentModeListener = currentModeCall?.[1] as
      | ((update: unknown) => void)
      | undefined;

    agentInstances[0]?.sessions.set('new-session-2', {
      ...agentInstances[0]?.sessions.get('new-session-2'),
      sessionId: 'new-session-2',
      cwd: '/tmp',
      mode: 'act',
      mcpServers: [],
      createdAt: Date.parse('2026-03-19T00:00:00.000Z'),
      lastActivityAt: Date.parse('2026-03-19T00:00:00.000Z'),
    });

    currentModeListener?.({ currentModeId: 'act' });
    await waitForAsyncWork();
    expect(agentInstances[0]?.setSessionMode).not.toHaveBeenCalled();

    resolvePrompt?.({ stopReason: 'completed' });
    await waitUntil(() => {
      expect(agentInstances[0]?.setSessionMode).toHaveBeenCalledWith({
        sessionId: 'new-session-2',
        modeId: 'plan',
      });
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
        ![
          'start_planning',
          'task_workspace_initializing',
          'task_workspace_ready',
        ].includes(event.reason ?? ''),
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
        ![
          'start_planning',
          'task_workspace_initializing',
          'task_workspace_ready',
        ].includes(event.reason ?? ''),
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
