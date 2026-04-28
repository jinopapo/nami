/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_service' | No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_ipc' */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  agentInstances,
  createUserDataPath,
  resetClineTestState,
  waitForAsyncWork,
  waitUntil,
} from './ClineSessionService.testHelper.js';
import { ClineSessionOrchestrator } from '../ipc/clineSessionOrchestrator.js';

describe('ClineSessionOrchestrator lifecycle transitions', () => {
  const originalClineDir = process.env.CLINE_DIR;

  afterEach(() => {
    resetClineTestState(originalClineDir);
  });

  it('restarts in plan mode when transitioning from awaiting_confirmation to planning', async () => {
    const userDataPath = await createUserDataPath('resume-planning');
    const service = new ClineSessionOrchestrator(userDataPath);
    const events: Array<
      Parameters<Parameters<typeof service.subscribe>[0]>[0]
    > = [];
    service.subscribe((event) => {
      events.push(event);
    });
    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'end_turn' })
      .mockImplementationOnce(() => new Promise(() => {}));
    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitUntil(() => {
      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'task-lifecycle-state-changed',
          taskId: task.taskId,
          state: 'awaiting_confirmation',
        }),
      );
    });

    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
      prompt: 'ここを反映して計画を更新して',
    });
    await waitUntil(() => {
      expect(agentInstances[0]?.prompt).toHaveBeenNthCalledWith(2, {
        sessionId: 'new-session-2',
        prompt: [
          {
            type: 'text',
            text: 'ここを反映して計画を更新して',
          },
        ],
      });
    });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'task-lifecycle-state-changed',
        taskId: task.taskId,
        state: 'planning',
        mode: 'plan',
        reason: 'retry_planning',
      }),
    );
    expect(agentInstances[0]?.setSessionMode).not.toHaveBeenCalled();
  });

  it('throws when transitioning from awaiting_confirmation to planning without a prompt', async () => {
    const userDataPath = await createUserDataPath('resume-planning-no-prompt');
    const service = new ClineSessionOrchestrator(userDataPath);
    agentInstances[0]?.prompt.mockResolvedValueOnce({ stopReason: 'end_turn' });
    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitUntil(() => {
      expect(
        service['runtimeService'].getTask(task.taskId).lifecycleState,
      ).toBe('awaiting_confirmation');
    });

    await expect(
      service.transitionTaskLifecycle({
        taskId: task.taskId,
        nextState: 'planning',
      }),
    ).rejects.toThrow('Prompt is required when restarting planning.');
  });

  it('uses the provided prompt when transitioning from awaiting_confirmation to planning', async () => {
    const userDataPath = await createUserDataPath(
      'resume-planning-with-custom-prompt',
    );
    const service = new ClineSessionOrchestrator(userDataPath);
    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'completed' })
      .mockImplementationOnce(() => new Promise(() => {}));
    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitUntil(() => {
      expect(
        service['runtimeService'].getTask(task.taskId).lifecycleState,
      ).toBe('awaiting_confirmation');
    });

    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
      prompt: 'この方針で練り直して',
    });
    await waitUntil(() => {
      expect(agentInstances[0]?.prompt).toHaveBeenLastCalledWith({
        sessionId: 'new-session-2',
        prompt: [{ type: 'text', text: 'この方針で練り直して' }],
      });
    });
  });

  it('switches to act mode and starts execution when transitioning from awaiting_confirmation to executing', async () => {
    const userDataPath = await createUserDataPath('start-executing');
    const service = new ClineSessionOrchestrator(userDataPath);
    const events: Array<
      Parameters<Parameters<typeof service.subscribe>[0]>[0]
    > = [];
    service.subscribe((event) => {
      events.push(event);
    });
    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'end_turn' })
      .mockImplementationOnce(() => new Promise(() => {}));
    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitUntil(() => {
      expect(
        service['runtimeService'].getTask(task.taskId).lifecycleState,
      ).toBe('awaiting_confirmation');
    });

    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'executing',
    });
    await waitUntil(() => {
      expect(agentInstances[0]?.prompt).toHaveBeenNthCalledWith(2, {
        sessionId: 'new-session-2',
        prompt: [
          {
            type: 'text',
            text: 'これまでの計画を踏まえて、actモードとして実行を開始してください。',
          },
        ],
      });
    });
    expect(agentInstances[0]?.setSessionMode).toHaveBeenCalledWith({
      sessionId: 'new-session-2',
      modeId: 'act',
    });
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'task-lifecycle-state-changed',
        taskId: task.taskId,
        state: 'executing',
        mode: 'act',
        reason: 'start_execution',
      }),
    );
  });

  it('switches back to plan mode before restarting planning only when the session mode is not already plan', async () => {
    const userDataPath = await createUserDataPath('restart-planning-mode-sync');
    const service = new ClineSessionOrchestrator(userDataPath);
    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'end_turn' })
      .mockImplementationOnce(() => new Promise(() => {}));
    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitUntil(() => {
      expect(
        service['runtimeService'].getTask(task.taskId).lifecycleState,
      ).toBe('awaiting_confirmation');
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
    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
      prompt: '計画を再調整して',
    });
    await waitForAsyncWork();
    expect(agentInstances[0]?.setSessionMode).toHaveBeenCalledWith({
      sessionId: 'new-session-2',
      modeId: 'plan',
    });
  });

  it('restores plan mode when current_mode_update switches to act while planning', async () => {
    const userDataPath = await createUserDataPath('current-mode-update');
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
    const sessionEvents = events.filter(
      (event) => event.type === 'session-update',
    );
    expect(sessionEvents).toContainEqual(
      expect.objectContaining({
        type: 'session-update',
        taskId: task.taskId,
        sessionId: task.sessionId,
        update: expect.objectContaining({
          sessionUpdate: 'current_mode_update',
          currentModeId: 'act',
        }),
      }),
    );

    await waitUntil(() => {
      const modeEvent = events.find(
        (event) =>
          event.type === 'task-lifecycle-state-changed' &&
          event.state === 'awaiting_confirmation',
      );
      expect(modeEvent).toEqual(expect.objectContaining({ mode: 'plan' }));
    });
  });
});
