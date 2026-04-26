export type TaskWorkspacePaths = {
  projectWorkspacePath: string;
  taskWorkspacePath: string;
};

export type TaskWorkspaceBranch = {
  taskBranchName: string;
  taskBranchManagement: 'system_managed' | 'user_managed';
  baseBranchName: string;
};

export type TaskWorkspaceReview = {
  reviewMergePolicy: 'merge_to_base' | 'preserve_branch';
};

export type TaskWorkspaceMergeState = {
  workspaceStatus:
    | 'initializing'
    | 'initialization_failed'
    | 'ready'
    | 'merge_pending'
    | 'merged'
    | 'merge_skipped'
    | 'merge_failed';
  mergeStatus: 'idle' | 'running' | 'succeeded' | 'failed';
  mergeFailureReason?:
    | 'conflict'
    | 'hook_failed'
    | 'worktrunk_unavailable'
    | 'not_git_repository'
    | 'command_failed'
    | 'unknown';
  mergeMessage?: string;
};

export type TaskWorkspaceBranchSelection = Pick<
  TaskWorkspaceBranch,
  'taskBranchName' | 'taskBranchManagement'
>;

export type TaskWorkspaceContext = TaskWorkspacePaths &
  TaskWorkspaceBranch &
  TaskWorkspaceReview &
  TaskWorkspaceMergeState;

export type PendingTaskWorkspaceContext = Omit<
  TaskWorkspaceContext,
  'workspaceStatus'
> & {
  workspaceStatus: 'initializing';
};

export type TaskWorkspaceMergeResult = Pick<
  TaskWorkspaceMergeState,
  'workspaceStatus' | 'mergeStatus' | 'mergeFailureReason' | 'mergeMessage'
>;
