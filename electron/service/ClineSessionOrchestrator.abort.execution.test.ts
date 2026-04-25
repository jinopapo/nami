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

describe('ClineSessionOrchestrator execution abort', () => {
  const originalClineDir = process.env.CLINE_DIR;

  afterEach(() => {
    resetClineTestState(originalClineDir);
  });

  it('keeps executing lifecycle state when the running execution turn is aborted', async () => {
    const userDataPath = await createUserDataPath('act-abort-keep-executing');
    const service = new ClineSessionOrchestrator(userDataPath);
    const events: Array<
      Parameters<Parameters<typeof service.subscribe>[0]>[0]
    > = [];
    service.subscribe((event) => events.push(event));
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
      const currentTask = service['runtimeService'].getTask(task.taskId);
      expect(currentTask.runtimeState).toBe('running');
      expect(currentTask.activeTurnId).toBeTruthy();
    });

    await service.abortTask(task.taskId);
    await waitForAsyncWork();

    const runtimeTask = service['runtimeService'].getTask(task.taskId);
    expect(runtimeTask.runtimeState).toBe('aborted');
    expect(runtimeTask.lifecycleState).toBe('executing');
    const lifecycleEvents = events.filter(
      (event) => event.type === 'task-lifecycle-state-changed',
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

  it('does not transition to auto checking when prompt completion races with abort', async () => {
    const userDataPath = await createUserDataPath(
      'act-abort-race-no-autocheck',
    );
    const service = new ClineSessionOrchestrator(userDataPath);
    const events: Array<
      Parameters<Parameters<typeof service.subscribe>[0]>[0]
    > = [];
    service.subscribe((event) => events.push(event));

    let resolveExecutionPrompt:
      | ((value: { stopReason: 'end_turn' }) => void)
      | undefined;
    let resolveCancel: (() => void) | undefined;

    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'end_turn' })
      .mockImplementationOnce(
        () =>
          new Promise<{ stopReason: 'end_turn' }>((resolve) => {
            resolveExecutionPrompt = resolve;
          }),
      );
    agentInstances[0]?.cancel.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCancel = resolve;
        }),
    );

    const workspaceAutoCheckService = (
      service as unknown as {
        workspaceAutoCheckService: {
          getConfig: ReturnType<typeof vi.fn>;
          runWithProgress: ReturnType<typeof vi.fn>;
        };
      }
    ).workspaceAutoCheckService;
    const getConfigSpy = vi
      .spyOn(workspaceAutoCheckService, 'getConfig')
      .mockResolvedValue({
        enabled: false,
        steps: [],
      });
    const runWithProgressSpy = vi.spyOn(
      workspaceAutoCheckService,
      'runWithProgress',
    );

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
      const currentTask = service['runtimeService'].getTask(task.taskId);
      expect(currentTask.runtimeState).toBe('running');
      expect(currentTask.activeTurnId).toBeTruthy();
    });

    const abortPromise = service.abortTask(task.taskId);
    await waitUntil(() => {
      expect(agentInstances[0]?.cancel).toHaveBeenCalledTimes(1);
    });

    resolveExecutionPrompt?.({ stopReason: 'end_turn' });
    await waitForAsyncWork();

    expect(getConfigSpy).not.toHaveBeenCalled();
    expect(runWithProgressSpy).not.toHaveBeenCalled();

    const lifecycleEvents = events.filter(
      (event) => event.type === 'task-lifecycle-state-changed',
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

    const taskBeforeCancelResolved = service['runtimeService'].getTask(
      task.taskId,
    );
    expect(taskBeforeCancelResolved.lifecycleState).toBe('executing');
    expect(taskBeforeCancelResolved.runtimeState).toBe('aborted');

    resolveCancel?.();
    await abortPromise;
  });
});
