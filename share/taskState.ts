export type TaskLifecycleState =
  | 'waiting_dependencies'
  | 'before_start'
  | 'planning'
  | 'awaiting_confirmation'
  | 'executing'
  | 'auto_checking'
  | 'awaiting_review'
  | 'completed';

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
