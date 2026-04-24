/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_service' */
import { describe, expect, it, vi } from 'vitest';
import { TaskWorkspaceService } from './TaskWorkspaceService.js';

describe('TaskWorkspaceService', () => {
  it('initializes task workspace context with generated branch name', async () => {
    const gitRepository = {
      getCurrentBranch: vi.fn().mockResolvedValue('main'),
      getWorktreePath: vi.fn().mockResolvedValue('/repo.task.123'),
      removeWorktree: vi.fn().mockResolvedValue(undefined),
      getReviewDiff: vi.fn(),
      commitReview: vi.fn(),
    };
    const workTrunkRepository = {
      createWorktree: vi.fn().mockResolvedValue(undefined),
      copyIgnoredFiles: vi.fn().mockResolvedValue(undefined),
      mergeCurrentWorktree: vi.fn(),
      pruneMergedWorktrees: vi.fn(),
    };
    const service = new TaskWorkspaceService(
      gitRepository as never,
      workTrunkRepository as never,
    );

    const result = await service.initializeForTask({
      taskId: 'task-123',
      projectWorkspacePath: '/repo',
    });

    expect(result).toMatchObject({
      projectWorkspacePath: '/repo',
      taskWorkspacePath: '/repo.task.123',
      taskBranchName: 'task/task-123',
      baseBranchName: 'main',
      shouldMergeAfterReview: true,
      workspaceStatus: 'ready',
      mergeStatus: 'idle',
    });

    expect(gitRepository.getCurrentBranch).toHaveBeenCalledWith('/repo');
    expect(workTrunkRepository.createWorktree).toHaveBeenCalledWith({
      projectWorkspacePath: '/repo',
      taskBranchName: 'task/task-123',
    });
    expect(gitRepository.getWorktreePath).toHaveBeenCalledWith(
      '/repo',
      'task/task-123',
    );
  });

  it('uses custom task branch and merge preference when provided', async () => {
    const gitRepository = {
      getCurrentBranch: vi.fn().mockResolvedValue('main'),
      getWorktreePath: vi.fn().mockResolvedValue('/repo.feature.small-pr'),
      removeWorktree: vi.fn().mockResolvedValue(undefined),
      getReviewDiff: vi.fn(),
      commitReview: vi.fn(),
    };
    const workTrunkRepository = {
      createWorktree: vi.fn().mockResolvedValue(undefined),
      copyIgnoredFiles: vi.fn().mockResolvedValue(undefined),
      mergeCurrentWorktree: vi.fn(),
      pruneMergedWorktrees: vi.fn(),
    };
    const service = new TaskWorkspaceService(
      gitRepository as never,
      workTrunkRepository as never,
    );

    const pending = service.createPendingForTask({
      taskId: 'task-123',
      projectWorkspacePath: '/repo',
      taskBranchName: ' feature/small-pr ',
      shouldMergeAfterReview: false,
    });
    const initialized = await service.initializeForTask({
      taskId: 'task-123',
      projectWorkspacePath: '/repo',
      taskBranchName: pending.taskBranchName,
      shouldMergeAfterReview: pending.shouldMergeAfterReview,
    });

    expect(pending).toMatchObject({
      taskBranchName: 'feature/small-pr',
      shouldMergeAfterReview: false,
    });
    expect(initialized).toMatchObject({
      taskBranchName: 'feature/small-pr',
      shouldMergeAfterReview: false,
    });
    expect(workTrunkRepository.createWorktree).toHaveBeenCalledWith({
      projectWorkspacePath: '/repo',
      taskBranchName: 'feature/small-pr',
    });
  });

  it('rejects invalid custom branch names', () => {
    const service = new TaskWorkspaceService({} as never, {} as never);

    expect(() =>
      service.createPendingForTask({
        taskId: 'task-123',
        projectWorkspacePath: '/repo',
        taskBranchName: '../main',
      }),
    ).toThrow('Invalid task branch name: ../main');
  });

  it('cleans up created worktree when initialization later needs rollback', async () => {
    const gitRepository = {
      getCurrentBranch: vi.fn(),
      getWorktreePath: vi.fn(),
      removeWorktree: vi.fn().mockResolvedValue(undefined),
      getReviewDiff: vi.fn(),
      commitReview: vi.fn(),
    };
    const workTrunkRepository = {
      createWorktree: vi.fn(),
      copyIgnoredFiles: vi.fn(),
      mergeCurrentWorktree: vi.fn(),
      pruneMergedWorktrees: vi.fn(),
    };
    const service = new TaskWorkspaceService(
      gitRepository as never,
      workTrunkRepository as never,
    );

    await service.cleanupAfterInitializationFailure({
      projectWorkspacePath: '/repo',
      taskWorkspacePath: '/repo.task.123',
      taskBranchName: 'task/task-123',
    });

    expect(gitRepository.removeWorktree).toHaveBeenCalledWith({
      projectWorkspacePath: '/repo',
      taskWorkspacePath: '/repo.task.123',
      taskBranchName: 'task/task-123',
    });
  });

  it('delegates review diff loading to repository', async () => {
    const gitRepository = {
      getCurrentBranch: vi.fn(),
      getWorktreePath: vi.fn(),
      removeWorktree: vi.fn(),
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
    const workTrunkRepository = {
      createWorktree: vi.fn(),
      copyIgnoredFiles: vi.fn(),
      mergeCurrentWorktree: vi.fn(),
      pruneMergedWorktrees: vi.fn(),
    };
    const service = new TaskWorkspaceService(
      gitRepository as never,
      workTrunkRepository as never,
    );

    const result = await service.getReviewDiff({
      taskWorkspacePath: '/repo.task.123',
      baseBranchName: 'main',
    });

    expect(gitRepository.getReviewDiff).toHaveBeenCalledWith({
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
    const gitRepository = {
      getCurrentBranch: vi.fn(),
      getWorktreePath: vi.fn(),
      removeWorktree: vi.fn(),
      getReviewDiff: vi.fn(),
      commitReview: vi.fn().mockResolvedValue({
        commitHash: 'abc123',
        output: '[task] commit message',
      }),
    };
    const workTrunkRepository = {
      createWorktree: vi.fn(),
      copyIgnoredFiles: vi.fn(),
      mergeCurrentWorktree: vi.fn(),
      pruneMergedWorktrees: vi.fn(),
    };
    const service = new TaskWorkspaceService(
      gitRepository as never,
      workTrunkRepository as never,
    );

    await expect(
      service.commitReview({
        taskWorkspacePath: '/repo.task.123',
        message: 'feat: review commit',
      }),
    ).resolves.toEqual({
      commitHash: 'abc123',
      output: '[task] commit message',
    });

    expect(gitRepository.commitReview).toHaveBeenCalledWith({
      taskWorkspacePath: '/repo.task.123',
      message: 'feat: review commit',
    });
  });
});
