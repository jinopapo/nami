import type { ReviewDiffFile } from '../../share/task.js';
import type {
  TaskWorkspaceContext,
  TaskWorkspaceMergeResult,
} from '../entity/taskWorkspace.js';
import { GitRepository } from '../repository/gitRepository.js';
import { WorkTrunkRepository } from '../repository/workTrunkRepository.js';

export class TaskWorkspaceService {
  constructor(
    private readonly gitRepository = new GitRepository(),
    private readonly workTrunkRepository = new WorkTrunkRepository(),
  ) {}

  getCurrentBranch(projectWorkspacePath: string): Promise<string> {
    return this.gitRepository.getCurrentBranch(projectWorkspacePath);
  }

  async initializeForTask(input: {
    taskId: string;
    projectWorkspacePath: string;
  }): Promise<TaskWorkspaceContext> {
    const taskBranchName = this.buildTaskBranchName(input.taskId);
    const baseBranchName = await this.gitRepository.getCurrentBranch(
      input.projectWorkspacePath,
    );
    await this.workTrunkRepository.createWorktree({
      projectWorkspacePath: input.projectWorkspacePath,
      taskBranchName,
    });
    const taskWorkspacePath = await this.gitRepository.getWorktreePath(
      input.projectWorkspacePath,
      taskBranchName,
    );
    if (!taskWorkspacePath) {
      throw new Error(`Failed to resolve worktree path for ${taskBranchName}`);
    }

    try {
      await this.workTrunkRepository.copyIgnoredFiles({
        taskWorkspacePath,
      });
    } catch {
      // copy-ignored は補助機能なので失敗しても初期化自体は継続する
    }

    return {
      projectWorkspacePath: input.projectWorkspacePath,
      taskWorkspacePath,
      taskBranchName,
      baseBranchName,
      workspaceStatus: 'ready',
      mergeStatus: 'idle',
    };
  }

  mergeToProjectWorkspace(input: {
    taskWorkspacePath: string;
    baseBranchName: string;
  }): Promise<TaskWorkspaceMergeResult> {
    return this.workTrunkRepository.mergeCurrentWorktree(input);
  }

  async getReviewDiff(input: {
    taskWorkspacePath: string;
    baseBranchName: string;
  }): Promise<ReviewDiffFile[]> {
    return this.gitRepository.getReviewDiff(input);
  }

  commitReview(input: {
    taskWorkspacePath: string;
    message: string;
  }): Promise<{ commitHash: string; output: string }> {
    return this.gitRepository.commitReview(input);
  }

  retryMerge(input: {
    taskWorkspacePath: string;
    baseBranchName: string;
  }): Promise<TaskWorkspaceMergeResult> {
    return this.mergeToProjectWorkspace(input);
  }

  cleanupAfterInitializationFailure(input: {
    projectWorkspacePath: string;
    taskWorkspacePath: string;
    taskBranchName: string;
  }): Promise<void> {
    return this.gitRepository.removeWorktree(input);
  }

  private buildTaskBranchName(taskId: string): string {
    return `task/${taskId.toLowerCase().replace(/[^a-z0-9/-]+/g, '-')}`;
  }
}
