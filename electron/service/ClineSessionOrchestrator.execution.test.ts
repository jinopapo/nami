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

describe('ClineSessionOrchestrator execution flow', () => {
  const originalClineDir = process.env.CLINE_DIR;

  afterEach(() => {
    resetClineTestState(originalClineDir);
  });

  it('moves to awaiting_review only when an execution turn stops with end_turn', async () => {
    const userDataPath = await createUserDataPath(
      'act-end-turn-awaiting-review',
    );
    const service = new ClineSessionOrchestrator(userDataPath);
    const events: Array<
      Parameters<Parameters<typeof service.subscribe>[0]>[0]
    > = [];
    service.subscribe((event) => {
      events.push(event);
    });
    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'end_turn' })
      .mockResolvedValueOnce({ stopReason: 'end_turn' });
    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    await service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitUntil(() => {
      expect(
        service['runtimeService'].getTask(task.taskId).lifecycleState,
      ).toBe('awaiting_confirmation');
    });
    await service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'executing',
    });
    await waitUntil(() => {
      const lifecycleEvents = events.filter(
        (event) => event.type === 'task-lifecycle-state-changed',
      );
      expect(lifecycleEvents).toContainEqual(
        expect.objectContaining({
          type: 'task-lifecycle-state-changed',
          taskId: task.taskId,
          state: 'awaiting_review',
          mode: 'act',
          reason: 'end_turn',
        }),
      );
    });
  });

  it('does not start auto check when an execution turn is stopped', async () => {
    const userDataPath = await createUserDataPath('act-cancelled-no-autocheck');
    const service = new ClineSessionOrchestrator(userDataPath);
    const events: Array<
      Parameters<Parameters<typeof service.subscribe>[0]>[0]
    > = [];
    service.subscribe((event) => {
      events.push(event);
    });
    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'end_turn' })
      .mockResolvedValueOnce({ stopReason: 'cancelled' });
    const workspaceAutoCheckService = (
      service as unknown as {
        workspaceAutoCheckService: {
          getConfig: ReturnType<typeof vi.fn>;
          runWithProgress: ReturnType<typeof vi.fn>;
        };
      }
    ).workspaceAutoCheckService;
    const getConfigSpy = vi.spyOn(workspaceAutoCheckService, 'getConfig');
    const runWithProgressSpy = vi.spyOn(
      workspaceAutoCheckService,
      'runWithProgress',
    );
    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    await service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitUntil(() => {
      expect(
        service['runtimeService'].getTask(task.taskId).lifecycleState,
      ).toBe('awaiting_confirmation');
    });
    await service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'executing',
    });
    await waitForAsyncWork();

    expect(getConfigSpy).not.toHaveBeenCalled();
    expect(runWithProgressSpy).not.toHaveBeenCalled();
    const lifecycleEvents = events.filter(
      (event) => event.type === 'task-lifecycle-state-changed',
    );
    expect(lifecycleEvents).toContainEqual(
      expect.objectContaining({
        type: 'task-lifecycle-state-changed',
        taskId: task.taskId,
        state: 'executing',
        mode: 'act',
        reason: 'start_execution',
      }),
    );
    expect(lifecycleEvents).not.toContainEqual(
      expect.objectContaining({
        type: 'task-lifecycle-state-changed',
        taskId: task.taskId,
        state: 'auto_checking',
      }),
    );
    expect(lifecycleEvents).not.toContainEqual(
      expect.objectContaining({
        type: 'task-lifecycle-state-changed',
        taskId: task.taskId,
        state: 'awaiting_review',
      }),
    );
  });
});
