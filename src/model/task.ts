type UiTaskRuntimeState =
  | 'idle'
  | 'running'
  | 'waiting_permission'
  | 'waiting_human_decision'
  | 'aborted'
  | 'completed'
  | 'error';

type TaskLifecycleState =
  | 'before_start'
  | 'planning'
  | 'awaiting_confirmation'
  | 'executing'
  | 'auto_checking'
  | 'awaiting_review'
  | 'completed';

type TaskWorkspaceStatus =
  | 'initializing'
  | 'initialization_failed'
  | 'ready'
  | 'merge_pending'
  | 'merged'
  | 'merge_skipped'
  | 'merge_failed';

type TaskMergeStatus = 'idle' | 'running' | 'succeeded' | 'failed';

type TaskMergeFailureReason =
  | 'conflict'
  | 'hook_failed'
  | 'worktrunk_unavailable'
  | 'not_git_repository'
  | 'command_failed'
  | 'unknown';

type UiReviewDiffCellChangeType = 'context' | 'added' | 'removed' | 'empty';

type UiReviewDiffFileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

type UiReviewDiffCell = {
  lineNumber?: number;
  text: string;
  changeType: UiReviewDiffCellChangeType;
};

type UiReviewDiffRow = {
  left: UiReviewDiffCell;
  right: UiReviewDiffCell;
};

type UiReviewDiffHunk = {
  header: string;
  rows: UiReviewDiffRow[];
};

export type UiReviewDiffFile = {
  path: string;
  oldPath?: string;
  newPath?: string;
  status: UiReviewDiffFileStatus;
  hunks: UiReviewDiffHunk[];
};

export type UiAutoCheckStep = {
  id: string;
  name: string;
  command: string;
};

export type UiAutoCheckConfig = {
  enabled: boolean;
  steps: UiAutoCheckStep[];
};

type UiAutoCheckStepResult = {
  stepId: string;
  name: string;
  command: string;
  success: boolean;
  exitCode: number;
  output: string;
  ranAt: string;
};

type UiAutoCheckResult = {
  success: boolean;
  exitCode: number;
  output: string;
  command: string;
  ranAt: string;
  steps: UiAutoCheckStepResult[];
  failedStep?: UiAutoCheckStepResult;
};

export type UiTask = {
  taskId: string;
  sessionId: string;
  cwd: string;
  projectWorkspacePath: string;
  taskWorkspacePath: string;
  taskBranchName: string;
  baseBranchName: string;
  shouldMergeAfterReview: boolean;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  lifecycleState: TaskLifecycleState;
  runtimeState: UiTaskRuntimeState;
  workspaceStatus: TaskWorkspaceStatus;
  mergeStatus: TaskMergeStatus;
  mergeFailureReason?: TaskMergeFailureReason;
  mergeMessage?: string;
  latestAutoCheckResult?: UiAutoCheckResult;
};

export type UiTaskCreationOptions = {
  taskBranchName: string;
  shouldMergeAfterReview: boolean;
};

export type UiReviewDiffInput = {
  taskWorkspacePath: string;
  baseBranchName: string;
};

export type UiCommitReviewInput = {
  taskWorkspacePath: string;
  message: string;
};

export type ReviewTabKey = 'chat' | 'commit';

export type AutoCheckFormState = UiAutoCheckConfig & {
  isDirty: boolean;
  isSaving: boolean;
  isRunning: boolean;
  lastResult?: UiAutoCheckResult;
};
