export type TaskWorkspaceStatus =
  | 'initializing'
  | 'initialization_failed'
  | 'ready'
  | 'merge_pending'
  | 'merged'
  | 'merge_skipped'
  | 'merge_failed';

export type TaskMergeStatus = 'idle' | 'running' | 'succeeded' | 'failed';

export type TaskBranchManagement = 'system_managed' | 'user_managed';

export type TaskReviewMergePolicy = 'merge_to_base' | 'preserve_branch';

export type TaskMergeFailureReason =
  | 'conflict'
  | 'hook_failed'
  | 'worktrunk_unavailable'
  | 'not_git_repository'
  | 'command_failed'
  | 'unknown';

export type TaskWorkspaceContext = {
  projectWorkspacePath: string;
  taskWorkspacePath: string;
  taskBranchName: string;
  taskBranchManagement: TaskBranchManagement;
  baseBranchName: string;
  reviewMergePolicy: TaskReviewMergePolicy;
  workspaceStatus: TaskWorkspaceStatus;
  mergeStatus: TaskMergeStatus;
  mergeFailureReason?: TaskMergeFailureReason;
  mergeMessage?: string;
};

export type PendingTaskWorkspaceContext = Omit<
  TaskWorkspaceContext,
  'workspaceStatus'
> & {
  workspaceStatus: 'initializing';
};

export type TaskWorkspaceMergeResult = Pick<
  TaskWorkspaceContext,
  'workspaceStatus' | 'mergeStatus' | 'mergeFailureReason' | 'mergeMessage'
>;
