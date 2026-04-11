import type {
  TaskMergeFailureReason,
  TaskMergeStatus,
  TaskWorkspaceStatus,
} from '../../core/task.js';

export type TaskWorkspaceContext = {
  projectWorkspacePath: string;
  taskWorkspacePath: string;
  taskBranchName: string;
  baseBranchName: string;
  workspaceStatus: TaskWorkspaceStatus;
  mergeStatus: TaskMergeStatus;
  mergeFailureReason?: TaskMergeFailureReason;
  mergeMessage?: string;
};

export type TaskWorkspaceMergeResult = Pick<
  TaskWorkspaceContext,
  'workspaceStatus' | 'mergeStatus' | 'mergeFailureReason' | 'mergeMessage'
>;
