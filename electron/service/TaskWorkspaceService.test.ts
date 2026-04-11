import { describe, expect, it, vi } from 'vitest';
import { TaskWorkspaceService } from './TaskWorkspaceService.js';

describe('TaskWorkspaceService', () => {
  it('initializes task workspace context with generated branch name', async () => {
    const repository = {
      createWorktree: vi.fn().mockResolvedValue({
        taskWorkspacePath: '/repo.task.123',
        taskBranchName: 'task/task-123',
        baseBranchName: 'main',
      }),
      copyIgnoredFiles: vi.fn().mockResolvedValue(undefined),
      removeWorktree: vi.fn().mockResolvedValue(undefined),
      mergeCurrentWorktree: vi.fn(),
    };
    const service = new TaskWorkspaceService(repository as never);

    const result = await service.initializeForTask({
      taskId: 'task-123',
      projectWorkspacePath: '/repo',
    });

    expect(result).toMatchObject({
      projectWorkspacePath: '/repo',
      taskWorkspacePath: '/repo.task.123',
      taskBranchName: 'task/task-123',
      baseBranchName: 'main',
      workspaceStatus: 'ready',
      mergeStatus: 'idle',
    });
  });

  it('cleans up created worktree when initialization later needs rollback', async () => {
    const repository = {
      createWorktree: vi.fn(),
      copyIgnoredFiles: vi.fn(),
      removeWorktree: vi.fn().mockResolvedValue(undefined),
      mergeCurrentWorktree: vi.fn(),
    };
    const service = new TaskWorkspaceService(repository as never);

    await service.cleanupAfterInitializationFailure({
      projectWorkspacePath: '/repo',
      taskWorkspacePath: '/repo.task.123',
      taskBranchName: 'task/task-123',
    });

    expect(repository.removeWorktree).toHaveBeenCalledWith({
      projectWorkspacePath: '/repo',
      taskWorkspacePath: '/repo.task.123',
      taskBranchName: 'task/task-123',
    });
  });

  it('delegates review diff loading to repository', async () => {
    const repository = {
      createWorktree: vi.fn(),
      copyIgnoredFiles: vi.fn(),
      removeWorktree: vi.fn(),
      mergeCurrentWorktree: vi.fn(),
      getReviewDiff: vi.fn().mockResolvedValue([
        {
          path: 'src/sample.ts',
          oldPath: 'src/sample.ts',
          newPath: 'src/sample.ts',
          status: 'modified',
          hunks: [],
        },
      ]),
      commitReview: vi.fn(),
    };
    const service = new TaskWorkspaceService(repository as never);

    const result = await service.getReviewDiff({
      taskWorkspacePath: '/repo.task.123',
      baseBranchName: 'main',
    });

    expect(repository.getReviewDiff).toHaveBeenCalledWith({
      taskWorkspacePath: '/repo.task.123',
      baseBranchName: 'main',
    });
    expect(result).toEqual([
      {
        path: 'src/sample.ts',
        oldPath: 'src/sample.ts',
        newPath: 'src/sample.ts',
        status: 'modified',
        hunks: [],
      },
    ]);
  });

  it('delegates review commit to repository', async () => {
    const repository = {
      createWorktree: vi.fn(),
      copyIgnoredFiles: vi.fn(),
      removeWorktree: vi.fn(),
      mergeCurrentWorktree: vi.fn(),
      getReviewDiff: vi.fn(),
      commitReview: vi.fn().mockResolvedValue({
        commitHash: 'abc123',
        output: '[task] commit message',
      }),
    };
    const service = new TaskWorkspaceService(repository as never);

    await expect(
      service.commitReview({
        taskWorkspacePath: '/repo.task.123',
        message: 'feat: review commit',
      }),
    ).resolves.toEqual({
      commitHash: 'abc123',
      output: '[task] commit message',
    });
  });
});
