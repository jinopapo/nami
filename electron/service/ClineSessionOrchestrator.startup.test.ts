/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_service' | No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_ipc' */
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
} from './ClineSessionService.testHelper.js';
import { ClineSessionOrchestrator } from '../ipc/clineSessionOrchestrator.js';

describe('ClineSessionOrchestrator startup flow', () => {
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
    expect(agentInstances[0]?.newSession).toHaveBeenCalledWith({
      cwd: '/tmp',
      mcpServers: [],
    });
    expect(agentInstances[0]?.setSessionMode).not.toHaveBeenCalled();
    expect(agentInstances[0]?.prompt).not.toHaveBeenCalled();
    expect(task.sessionId).toBe('new-session-1');
    expect(task.taskId).toBeTruthy();
    expect(task.lifecycleState).toBe('before_start');
    expect(task.runtimeState).toBe('idle');
    expect(task.workspaceStatus).toBe('initializing');
    expect(task.projectWorkspacePath).toBe('/tmp');
    expect(task.cwd).toBe('/tmp');
    expect(task.taskWorkspacePath).toBe('');
    expect(task.dependencyTaskIds).toEqual([]);
    expect(task.pendingDependencyTaskIds).toEqual([]);
  });

  it('creates a dependent task in waiting_dependencies until prerequisites complete', async () => {
    const userDataPath = await createUserDataPath('waiting-dependencies');
    const service = new ClineSessionOrchestrator(userDataPath);

    const parentTask = await service.startTask({
      cwd: '/tmp',
      prompt: 'parent',
    });
    const dependentTask = await service.startTask({
      cwd: '/tmp',
      prompt: 'child',
      dependencyTaskIds: [parentTask.taskId],
    });

    expect(dependentTask.lifecycleState).toBe('waiting_dependencies');
    expect(dependentTask.dependencyTaskIds).toEqual([parentTask.taskId]);
    expect(dependentTask.pendingDependencyTaskIds).toEqual([parentTask.taskId]);
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

  it('creates task workspace only when transitioning from before_start to planning', async () => {
    const userDataPath = await createUserDataPath('delayed-workspace-init');
    const service = new ClineSessionOrchestrator(userDataPath);

    const initializeSpy = vi.spyOn(
      (
        service as unknown as {
          taskWorkspaceService: {
            initializeForTask: (...args: unknown[]) => unknown;
          };
        }
      ).taskWorkspaceService,
      'initializeForTask',
    );

    const task = await service.startTask({ cwd: '/tmp', prompt: 'hello' });

    expect(initializeSpy).not.toHaveBeenCalled();

    service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });

    await waitUntil(() => {
      expect(initializeSpy).toHaveBeenCalledWith({
        taskId: task.taskId,
        projectWorkspacePath: '/tmp',
        taskBranchName: task.taskBranchName,
        taskBranchManagement: 'system_managed',
        reviewMergePolicy: 'merge_to_base',
      });
    });
  });
});
