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
    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await Promise.resolve();
    await Promise.resolve();
    service.transitionTaskLifecycle({
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

  it('runs auto check before awaiting_review when an execution turn stops with completed', async () => {
    const userDataPath = await createUserDataPath('act-completed-auto-check');
    const service = new ClineSessionOrchestrator(userDataPath);
    const events: Array<
      Parameters<Parameters<typeof service.subscribe>[0]>[0]
    > = [];
    service.subscribe((event) => {
      events.push(event);
    });
    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'end_turn' })
      .mockResolvedValueOnce({ stopReason: 'completed' });
    const workspaceAutoCheckService = (
      service as unknown as {
        workspaceAutoCheckService: {
          getConfig: ReturnType<typeof vi.fn>;
          runWithProgress: ReturnType<typeof vi.fn>;
        };
      }
    ).workspaceAutoCheckService;
    vi.spyOn(workspaceAutoCheckService, 'getConfig').mockResolvedValue({
      enabled: true,
      steps: [{ id: 'step-1', name: 'Test', command: 'npm test' }],
    });
    vi.spyOn(workspaceAutoCheckService, 'runWithProgress').mockResolvedValue({
      success: true,
      exitCode: 0,
      output: 'ok',
      command: 'npm test',
      ranAt: '2026-03-19T00:00:00.000Z',
      steps: [
        {
          stepId: 'step-1',
          name: 'Test',
          command: 'npm test',
          success: true,
          exitCode: 0,
          output: 'ok',
          ranAt: '2026-03-19T00:00:00.000Z',
        },
      ],
    });
    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await Promise.resolve();
    await Promise.resolve();
    service.transitionTaskLifecycle({
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
          state: 'auto_checking',
          mode: 'act',
          reason: 'auto_check_started',
        }),
      );
      expect(lifecycleEvents).toContainEqual(
        expect.objectContaining({
          type: 'task-lifecycle-state-changed',
          taskId: task.taskId,
          state: 'awaiting_review',
          mode: 'act',
          reason: 'auto_check_passed',
          autoCheckResult: expect.objectContaining({
            success: true,
            command: 'npm test',
          }),
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
    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await Promise.resolve();
    await Promise.resolve();
    service.transitionTaskLifecycle({
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

  it('returns to executing when auto check fails after execution completes', async () => {
    const userDataPath = await createUserDataPath(
      'act-completed-auto-check-failed',
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
      .mockResolvedValueOnce({ stopReason: 'completed' })
      .mockImplementationOnce(() => new Promise(() => {}));
    const workspaceAutoCheckService = (
      service as unknown as {
        workspaceAutoCheckService: {
          getConfig: ReturnType<typeof vi.fn>;
          runWithProgress: ReturnType<typeof vi.fn>;
        };
      }
    ).workspaceAutoCheckService;
    vi.spyOn(workspaceAutoCheckService, 'getConfig').mockResolvedValue({
      enabled: true,
      steps: [{ id: 'step-1', name: 'Test', command: 'npm test' }],
    });
    vi.spyOn(workspaceAutoCheckService, 'runWithProgress').mockResolvedValue({
      success: false,
      exitCode: 1,
      output: 'failed',
      command: 'npm test',
      ranAt: '2026-03-19T00:00:00.000Z',
      steps: [
        {
          stepId: 'step-1',
          name: 'Test',
          command: 'npm test',
          success: false,
          exitCode: 1,
          output: 'failed',
          ranAt: '2026-03-19T00:00:00.000Z',
        },
      ],
      failedStep: {
        stepId: 'step-1',
        name: 'Test',
        command: 'npm test',
        success: false,
        exitCode: 1,
        output: 'failed',
        ranAt: '2026-03-19T00:00:00.000Z',
      },
    });
    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await Promise.resolve();
    await Promise.resolve();
    service.transitionTaskLifecycle({
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
          state: 'auto_checking',
          mode: 'act',
          reason: 'auto_check_started',
        }),
      );
      expect(lifecycleEvents).toContainEqual(
        expect.objectContaining({
          type: 'task-lifecycle-state-changed',
          taskId: task.taskId,
          state: 'executing',
          mode: 'act',
          reason: 'auto_check_failed',
          autoCheckResult: expect.objectContaining({
            success: false,
            command: 'npm test',
          }),
        }),
      );
    });
  });
});
