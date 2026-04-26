/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_service' | No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_ipc' */
import { afterEach, describe, expect, it } from 'vitest';
import {
  agentInstances,
  createUserDataPath,
  resetClineTestState,
  waitUntil,
} from './ClineSessionService.testHelper.js';
import { ClineSessionOrchestrator } from '../ipc/clineSessionOrchestrator.js';

describe('ClineSessionOrchestrator retry flow', () => {
  const originalClineDir = process.env.CLINE_DIR;

  afterEach(() => {
    resetClineTestState(originalClineDir);
  });

  it('retries a failed planning prompt with the last planning prompt', async () => {
    const userDataPath = await createUserDataPath('retry-planning-after-error');
    const service = new ClineSessionOrchestrator(userDataPath);
    agentInstances[0]?.prompt
      .mockRejectedValueOnce(new Error('provider failed'))
      .mockImplementationOnce(() => new Promise(() => {}));

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    await service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });

    await waitUntil(() => {
      expect(service['runtimeService'].getTask(task.taskId).runtimeState).toBe(
        'error',
      );
    });

    await service.resumeTask({ taskId: task.taskId, reason: 'resume' });

    await waitUntil(() => {
      expect(agentInstances[0]?.prompt).toHaveBeenNthCalledWith(2, {
        sessionId: 'new-session-2',
        prompt: [{ type: 'text', text: 'plan this' }],
      });
    });
  });

  it('retries a failed execution prompt with the execution start prompt', async () => {
    const userDataPath = await createUserDataPath(
      'retry-executing-after-error',
    );
    const service = new ClineSessionOrchestrator(userDataPath);
    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'end_turn' })
      .mockRejectedValueOnce(new Error('provider failed'))
      .mockImplementationOnce(() => new Promise(() => {}));

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
      expect(service['runtimeService'].getTask(task.taskId).runtimeState).toBe(
        'error',
      );
    });

    await service.resumeTask({ taskId: task.taskId, reason: 'resume' });

    await waitUntil(() => {
      expect(agentInstances[0]?.prompt).toHaveBeenNthCalledWith(3, {
        sessionId: 'new-session-2',
        prompt: [
          {
            type: 'text',
            text: 'これまでの計画を踏まえて、actモードとして実行を開始してください。',
          },
        ],
      });
    });
  });

  it('deduplicates concurrent retry requests for the same errored task', async () => {
    const userDataPath = await createUserDataPath('retry-dedup');
    const service = new ClineSessionOrchestrator(userDataPath);
    agentInstances[0]?.prompt.mockRejectedValueOnce(
      new Error('provider failed'),
    );
    agentInstances[0]?.prompt.mockImplementationOnce(
      () => new Promise(() => {}),
    );

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    await service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitUntil(() => {
      expect(service['runtimeService'].getTask(task.taskId).runtimeState).toBe(
        'error',
      );
    });

    const firstRetry = service.resumeTask({
      taskId: task.taskId,
      reason: 'resume',
    });
    const secondRetry = service.resumeTask({
      taskId: task.taskId,
      reason: 'resume',
    });

    await Promise.all([firstRetry, secondRetry]);

    expect(agentInstances[0]?.prompt).toHaveBeenCalledTimes(2);
  });
});
