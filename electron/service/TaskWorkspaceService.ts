import type { ReviewDiffFile } from '../../core/task.js';
import type {
  TaskWorkspaceContext,
  TaskWorkspaceMergeResult,
} from '../entity/taskWorkspace.js';
import { WorkTrunkRepository } from '../repository/workTrunkRepository.js';

export class TaskWorkspaceService {
  constructor(private readonly repository = new WorkTrunkRepository()) {}

  getCurrentBranch(projectWorkspacePath: string): Promise<string> {
    return this.repository.getCurrentBranch(projectWorkspacePath);
  }

  async initializeForTask(input: {
    taskId: string;
    projectWorkspacePath: string;
  }): Promise<TaskWorkspaceContext> {
    const taskBranchName = this.buildTaskBranchName(input.taskId);
    const result = await this.repository.createWorktree({
      projectWorkspacePath: input.projectWorkspacePath,
      taskBranchName,
    });

    try {
      await this.repository.copyIgnoredFiles({
        taskWorkspacePath: result.taskWorkspacePath,
      });
    } catch {
      // copy-ignored は補助機能なので失敗しても初期化自体は継続する
    }

    return {
      projectWorkspacePath: input.projectWorkspacePath,
      taskWorkspacePath: result.taskWorkspacePath,
      taskBranchName: result.taskBranchName,
      baseBranchName: result.baseBranchName,
      workspaceStatus: 'ready',
      mergeStatus: 'idle',
    };
  }

  mergeToProjectWorkspace(input: {
    taskWorkspacePath: string;
    baseBranchName: string;
  }): Promise<TaskWorkspaceMergeResult> {
    return this.repository.mergeCurrentWorktree(input);
  }

  async getReviewDiff(input: {
    taskWorkspacePath: string;
    baseBranchName: string;
  }): Promise<ReviewDiffFile[]> {
    return this.repository.getReviewDiff(input);
  }

  commitReview(input: {
    taskWorkspacePath: string;
    message: string;
  }): Promise<{ commitHash: string; output: string }> {
    return this.repository.commitReview(input);
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
    return this.repository.removeWorktree(input);
  }

  private buildTaskBranchName(taskId: string): string {
    return `task/${taskId.toLowerCase().replace(/[^a-z0-9/-]+/g, '-')}`;
  }
}
