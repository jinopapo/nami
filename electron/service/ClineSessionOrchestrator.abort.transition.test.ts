/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_service' | No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_ipc' */
import { afterEach, describe, expect, it } from 'vitest';
import {
  agentInstances,
  createUserDataPath,
  resetClineTestState,
  waitForAsyncWork,
  waitUntil,
} from './ClineSessionService.testHelper.js';
import { ClineSessionOrchestrator } from '../ipc/clineSessionOrchestrator.js';

describe('ClineSessionOrchestrator planning abort', () => {
  const originalClineDir = process.env.CLINE_DIR;

  afterEach(() => {
    resetClineTestState(originalClineDir);
  });

  it('keeps planning lifecycle state when the running planning turn is aborted', async () => {
    const userDataPath = await createUserDataPath('plan-abort-keep-planning');
    const service = new ClineSessionOrchestrator(userDataPath);
    const events: Array<
      Parameters<Parameters<typeof service.subscribe>[0]>[0]
    > = [];
    service.subscribe((event) => events.push(event));
    agentInstances[0]?.prompt.mockImplementation(() => new Promise(() => {}));

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
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
    expect(runtimeTask.lifecycleState).toBe('planning');
    const lifecycleEvents = events.filter(
      (event) => event.type === 'task-lifecycle-state-changed',
    );
    expect(lifecycleEvents).not.toContainEqual(
      expect.objectContaining({
        type: 'task-lifecycle-state-changed',
        taskId: task.taskId,
        state: 'awaiting_confirmation',
      }),
    );
  });
});
