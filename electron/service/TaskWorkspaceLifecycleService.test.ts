/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_service' */
import { describe, expect, it, vi } from 'vitest';
import { TaskWorkspaceLifecycleService } from './TaskWorkspaceLifecycleService.js';

const createTask = (overrides: Record<string, unknown> = {}) => ({
  taskId: 'task-1',
  sessionId: 'session-1',
  taskWorkspacePath: '/repo.task.1',
  baseBranchName: 'main',
  taskBranchManagement: 'system_managed',
  reviewMergePolicy: 'merge_to_base',
  lifecycleState: 'awaiting_review',
  mode: 'act',
  ...overrides,
});

describe('TaskWorkspaceLifecycleService', () => {
  it('skips merge and completes the task when merge after review is disabled', async () => {
    const task = createTask({
      taskBranchManagement: 'user_managed',
      reviewMergePolicy: 'preserve_branch',
    });
    const runtimeService = {
      getTask: vi.fn(() => task),
      updateTaskWorkspace: vi.fn((_, workspace) =>
        Object.assign(task, workspace),
      ),
      updateLifecycleState: vi.fn((_, state, reason) =>
        Object.assign(task, { lifecycleState: state, reason }),
      ),
    };
    const taskWorkspaceService = {
      mergeToProjectWorkspace: vi.fn(),
    };
    const service = new TaskWorkspaceLifecycleService(
      runtimeService as never,
      taskWorkspaceService as never,
    );
    const emit = vi.fn();

    await service.completeTask('task-1', emit);

    expect(taskWorkspaceService.mergeToProjectWorkspace).not.toHaveBeenCalled();
    expect(runtimeService.updateTaskWorkspace).toHaveBeenCalledWith('task-1', {
      workspaceStatus: 'merge_skipped',
      mergeStatus: 'idle',
      mergeFailureReason: undefined,
      mergeMessage: undefined,
    });
    expect(runtimeService.updateLifecycleState).toHaveBeenCalledWith(
      'task-1',
      'completed',
      'merge_skipped',
    );
    expect(emit).toHaveBeenCalledWith(
      'task-1',
      'session-1',
      'completed',
      'merge_skipped',
      'act',
    );
  });
});
