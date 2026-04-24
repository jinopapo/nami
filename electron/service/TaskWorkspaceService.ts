/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'share' */
import type { ReviewDiffFile } from '../../share/task.js';
import type {
  PendingTaskWorkspaceContext,
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

  createPendingForTask(input: {
    taskId: string;
    projectWorkspacePath: string;
    taskBranchName?: string;
    shouldMergeAfterReview?: boolean;
  }): PendingTaskWorkspaceContext {
    const taskBranchName = this.resolveTaskBranchName({
      taskId: input.taskId,
      taskBranchName: input.taskBranchName,
    });
    return {
      projectWorkspacePath: input.projectWorkspacePath,
      taskWorkspacePath: '',
      taskBranchName,
      baseBranchName: '',
      shouldMergeAfterReview: input.shouldMergeAfterReview ?? true,
      workspaceStatus: 'initializing',
      mergeStatus: 'idle',
    };
  }

  async initializeForTask(input: {
    taskId: string;
    projectWorkspacePath: string;
    taskBranchName?: string;
    shouldMergeAfterReview?: boolean;
  }): Promise<TaskWorkspaceContext> {
    const taskBranchName = this.resolveTaskBranchName({
      taskId: input.taskId,
      taskBranchName: input.taskBranchName,
    });
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
      shouldMergeAfterReview: input.shouldMergeAfterReview ?? true,
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

  private resolveTaskBranchName(input: {
    taskId: string;
    taskBranchName?: string;
  }): string {
    const taskBranchName =
      input.taskBranchName?.trim() || this.buildTaskBranchName(input.taskId);
    this.assertValidBranchName(taskBranchName);
    return taskBranchName;
  }

  private assertValidBranchName(branchName: string): void {
    if (
      branchName.startsWith('-') ||
      branchName.startsWith('/') ||
      branchName.endsWith('/') ||
      branchName.endsWith('.') ||
      branchName.includes('..') ||
      branchName.includes('//') ||
      branchName.includes('@{') ||
      /[\s~^:?*[\\\]]/.test(branchName) ||
      branchName.split('/').some((segment) => {
        return !segment || segment.startsWith('.') || segment.endsWith('.lock');
      })
    ) {
      throw new Error(`Invalid task branch name: ${branchName}`);
    }
  }
}
