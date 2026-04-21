/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_service' | No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_ipc' */
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  agentInstances,
  createUserDataPath,
  resetClineTestState,
} from './ClineSessionService.testHelper.js';
import { ClineSessionOrchestrator } from '../ipc/clineSessionOrchestrator.js';

describe('ClineSessionOrchestrator planning workspace initialization', () => {
  const originalClineDir = process.env.CLINE_DIR;

  afterEach(() => {
    resetClineTestState(originalClineDir);
  });

  it('coalesces concurrent planning starts to avoid duplicate workspace initialization', async () => {
    const userDataPath = await createUserDataPath('coalesce-planning-start');
    const service = new ClineSessionOrchestrator(userDataPath);
    const initializeSpy = vi.spyOn(
      (
        service as unknown as {
          taskWorkspaceService: {
            initializeForTask: (...args: unknown[]) => Promise<unknown>;
          };
        }
      ).taskWorkspaceService,
      'initializeForTask',
    );

    const task = await service.startTask({ cwd: '/tmp', prompt: 'hello' });

    await Promise.all([
      service.transitionTaskLifecycle({
        taskId: task.taskId,
        nextState: 'planning',
      }),
      service.transitionTaskLifecycle({
        taskId: task.taskId,
        nextState: 'planning',
      }),
    ]);

    expect(initializeSpy).toHaveBeenCalledTimes(1);
    expect(agentInstances[0]?.prompt).toHaveBeenCalledTimes(1);
  });

  it('updates runtime and workspace state when task workspace session initialization fails', async () => {
    const userDataPath = await createUserDataPath(
      'planning-session-init-failed',
    );
    const service = new ClineSessionOrchestrator(userDataPath);
    const events: Array<
      Parameters<Parameters<typeof service.subscribe>[0]>[0]
    > = [];
    service.subscribe((event) => {
      events.push(event);
    });
    const newSessionMock = agentInstances[0]!.newSession;
    newSessionMock.mockImplementationOnce(async ({ cwd }: { cwd: string }) => {
      const session = {
        sessionId: 'new-session-1',
        cwd,
        mode: 'plan' as const,
        mcpServers: [] as [],
        createdAt: Date.parse('2026-03-19T00:00:00.000Z'),
        lastActivityAt: Date.parse('2026-03-19T00:00:00.000Z'),
      };
      agentInstances[0]!.sessions.set(session.sessionId, session);
      return {
        sessionId: session.sessionId,
        modes: { currentModeId: 'plan' },
      };
    });
    newSessionMock.mockRejectedValueOnce(new Error('session init failed'));

    const task = await service.startTask({ cwd: '/tmp', prompt: 'hello' });

    await expect(
      service.transitionTaskLifecycle({
        taskId: task.taskId,
        nextState: 'planning',
      }),
    ).rejects.toThrow('session init failed');

    const failedTask = service['runtimeService'].getTask(task.taskId);
    expect(failedTask.lifecycleState).toBe('before_start');
    expect(failedTask.runtimeState).toBe('error');
    expect(failedTask.workspaceStatus).toBe('initialization_failed');
    expect(failedTask.taskWorkspacePath).toBe('');
    expect(failedTask.mergeStatus).toBe('failed');
    expect(failedTask.mergeMessage).toBe('session init failed');

    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'task-lifecycle-state-changed',
        taskId: task.taskId,
        state: 'before_start',
        reason: 'task_workspace_initialization_failed',
        workspaceStatus: 'initialization_failed',
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'chat-runtime-state-changed',
        taskId: task.taskId,
        state: 'error',
        reason: 'task_workspace_initialization_failed',
      }),
    );
  });
});
