import type {
  AutoApprovalConfig,
  AutoCheckConfig,
  AutoCheckResult,
} from './taskAutoCheck.js';
import type { ReviewDiffFile } from './taskReviewDiff.js';
import type { TaskLifecycleState, TaskReviewMergePolicy } from './taskState.js';

export type {
  AutoApprovalConfig,
  AutoCheckConfig,
  AutoCheckFeedbackEvent,
  AutoCheckResult,
  AutoCheckRunSummary,
  AutoCheckStepEvent,
} from './taskAutoCheck.js';
export type { TaskEvent } from './taskEvent.js';
export type { ReviewDiffFile } from './taskReviewDiff.js';
export type { TaskSummary } from './taskSummary.js';
export type {
  TaskBranchManagement,
  TaskLifecycleState,
  TaskMergeFailureReason,
  TaskMergeStatus,
  TaskReviewMergePolicy,
  TaskWorkspaceStatus,
} from './taskState.js';

export type CreateTaskInput = {
  cwd?: string;
  prompt: string;
  taskBranchName?: string;
  reviewMergePolicy?: TaskReviewMergePolicy;
  dependencyTaskIds?: string[];
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

export type UpdateTaskDependenciesInput = {
  taskId: string;
  dependencyTaskIds: string[];
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

export type GetAutoApprovalConfigInput = {
  cwd: string;
};

export type GetAutoApprovalConfigResult = {
  config: AutoApprovalConfig;
};

export type SaveAutoApprovalConfigInput = {
  cwd: string;
  config: AutoApprovalConfig;
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
