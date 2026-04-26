type ChatRuntimeState =
  | 'idle'
  | 'running'
  | 'waiting_permission'
  | 'waiting_human_decision'
  | 'aborted'
  | 'completed'
  | 'error';

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type TaskLifecycleState =
  | 'before_start'
  | 'planning'
  | 'awaiting_confirmation'
  | 'executing'
  | 'auto_checking'
  | 'awaiting_review'
  | 'completed';

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type TaskWorkspaceStatus =
  | 'initializing'
  | 'initialization_failed'
  | 'ready'
  | 'merge_pending'
  | 'merged'
  | 'merge_skipped'
  | 'merge_failed';

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type TaskMergeStatus = 'idle' | 'running' | 'succeeded' | 'failed';

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type TaskBranchManagement = 'system_managed' | 'user_managed';

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type TaskReviewMergePolicy = 'merge_to_base' | 'preserve_branch';

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type TaskMergeFailureReason =
  | 'conflict'
  | 'hook_failed'
  | 'worktrunk_unavailable'
  | 'not_git_repository'
  | 'command_failed'
  | 'unknown';

type ReviewDiffCellChangeType = 'context' | 'added' | 'removed' | 'empty';

type ReviewDiffFileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

type ReviewDiffCell = {
  lineNumber?: number;
  text: string;
  changeType: ReviewDiffCellChangeType;
};

type ReviewDiffRow = {
  left: ReviewDiffCell;
  right: ReviewDiffCell;
};

type ReviewDiffHunk = {
  header: string;
  rows: ReviewDiffRow[];
};

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type ReviewDiffFile = {
  path: string;
  oldPath?: string;
  newPath?: string;
  status: ReviewDiffFileStatus;
  hunks: ReviewDiffHunk[];
};

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type AutoCheckStep = {
  id: string;
  name: string;
  command: string;
};

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type AutoCheckConfig = {
  enabled: boolean;
  steps: AutoCheckStep[];
};

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type AutoCheckStepResult = {
  stepId: string;
  name: string;
  command: string;
  success: boolean;
  exitCode: number;
  output: string;
  ranAt: string;
};

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type AutoCheckResult = {
  success: boolean;
  exitCode: number;
  output: string;
  command: string;
  ranAt: string;
  steps: AutoCheckStepResult[];
  failedStep?: AutoCheckStepResult;
};

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type AutoCheckRunSummary = {
  autoCheckRunId: string;
  steps: AutoCheckStep[];
};

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type AutoCheckStepEvent = {
  autoCheckRunId: string;
  stepId: string;
  name: string;
  command: string;
  phase: 'started' | 'finished';
  success?: boolean;
  exitCode?: number;
  output?: string;
  ranAt?: string;
};

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type AutoCheckFeedbackEvent = {
  autoCheckRunId: string;
  stepId: string;
  name: string;
  command: string;
  exitCode: number;
  output: string;
  prompt: string;
};

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type TaskSummary = {
  taskId: string;
  sessionId: string;
  cwd: string;
  projectWorkspacePath: string;
  taskWorkspacePath: string;
  taskBranchName: string;
  taskBranchManagement: TaskBranchManagement;
  baseBranchName: string;
  reviewMergePolicy: TaskReviewMergePolicy;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  lifecycleState: TaskLifecycleState;
  runtimeState: ChatRuntimeState;
  workspaceStatus: TaskWorkspaceStatus;
  mergeStatus: TaskMergeStatus;
  mergeFailureReason?: TaskMergeFailureReason;
  mergeMessage?: string;
  latestAutoCheckResult?: AutoCheckResult;
};

export type TaskEvent =
  | {
      type: 'taskCreated';
      task: TaskSummary;
      timestamp: string;
    }
  | {
      type: 'taskLifecycleStateChanged';
      taskId: string;
      sessionId: string;
      timestamp: string;
      state: TaskLifecycleState;
      mode?: 'plan' | 'act';
      reason?: string;
      projectWorkspacePath?: string;
      taskWorkspacePath?: string;
      taskBranchName?: string;
      taskBranchManagement?: TaskBranchManagement;
      baseBranchName?: string;
      reviewMergePolicy?: TaskReviewMergePolicy;
      workspaceStatus?: TaskWorkspaceStatus;
      mergeStatus?: TaskMergeStatus;
      mergeFailureReason?: TaskMergeFailureReason;
      mergeMessage?: string;
      autoCheckResult?: AutoCheckResult;
    }
  | {
      type: 'autoCheckStarted';
      taskId: string;
      sessionId: string;
      timestamp: string;
      run: AutoCheckRunSummary;
    }
  | {
      type: 'autoCheckStep';
      taskId: string;
      sessionId: string;
      timestamp: string;
      step: AutoCheckStepEvent;
    }
  | {
      type: 'autoCheckCompleted';
      taskId: string;
      sessionId: string;
      timestamp: string;
      result: AutoCheckResult;
      autoCheckRunId: string;
    }
  | {
      type: 'autoCheckFeedbackPrepared';
      taskId: string;
      sessionId: string;
      timestamp: string;
      feedback: AutoCheckFeedbackEvent;
    };

export type CreateTaskInput = {
  cwd?: string;
  prompt: string;
  taskBranchName?: string;
  reviewMergePolicy?: TaskReviewMergePolicy;
};

export type CreateTaskResult = {
  taskId: string;
  sessionId: string;
  turnId?: string;
};

export type TransitionTaskLifecycleInput = {
  taskId: string;
  nextState: TaskLifecycleState;
  prompt?: string;
};

export type SelectDirectoryInput = {
  defaultPath?: string;
};

export type GetCurrentBranchInput = {
  cwd: string;
};

export type GetCurrentBranchResult = {
  branch: string;
};

export type GetAutoCheckConfigInput = {
  cwd: string;
};

export type GetAutoCheckConfigResult = {
  config: AutoCheckConfig;
};

export type SaveAutoCheckConfigInput = {
  cwd: string;
  config: AutoCheckConfig;
};

export type RunAutoCheckInput = {
  cwd: string;
  config?: AutoCheckConfig;
};

export type RunAutoCheckResult = {
  result: AutoCheckResult;
};

export type GetReviewDiffInput = {
  taskWorkspacePath: string;
  baseBranchName: string;
};

export type GetReviewDiffResult = {
  files: ReviewDiffFile[];
};

export type CommitReviewInput = {
  taskWorkspacePath: string;
  message: string;
};

export type CommitReviewResult = {
  commitHash: string;
  output: string;
};
