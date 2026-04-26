import type { TaskSummary, TaskEvent } from '../../share/task';
import type { UiTask } from '../model/task';

type AutoCheckResult = UiTask['latestAutoCheckResult'];

const canMergeAfterReview = (
  reviewMergePolicy: UiTask['reviewMergePolicy'],
): boolean => reviewMergePolicy === 'merge_to_base';

type TaskStateUpdate = {
  taskId: string;
  sessionId?: UiTask['sessionId'];
  lifecycleState?: UiTask['lifecycleState'];
  runtimeState?: UiTask['runtimeState'];
  mode?: UiTask['mode'];
  updatedAt?: string;
  projectWorkspacePath?: UiTask['projectWorkspacePath'];
  taskWorkspacePath?: UiTask['taskWorkspacePath'];
  taskBranchName?: UiTask['taskBranchName'];
  taskBranchManagement?: UiTask['taskBranchManagement'];
  baseBranchName?: UiTask['baseBranchName'];
  reviewMergePolicy?: UiTask['reviewMergePolicy'];
  canMergeAfterReview?: UiTask['canMergeAfterReview'];
  workspaceStatus?: UiTask['workspaceStatus'];
  mergeStatus?: UiTask['mergeStatus'];
  mergeFailureReason?: UiTask['mergeFailureReason'];
  mergeMessage?: UiTask['mergeMessage'];
  clearMergeFailure?: boolean;
  latestAutoCheckResult?: AutoCheckResult;
};

const shouldClearMergeFailure = (input: {
  workspaceStatus?: UiTask['workspaceStatus'];
  mergeStatus?: UiTask['mergeStatus'];
}) =>
  input.workspaceStatus === 'merged' ||
  input.workspaceStatus === 'merge_skipped' ||
  input.mergeStatus === 'succeeded';

const toUiTask = (task: TaskSummary): UiTask => ({
  taskId: task.taskId,
  sessionId: task.sessionId,
  cwd: task.cwd,
  projectWorkspacePath: task.projectWorkspacePath,
  taskWorkspacePath: task.taskWorkspacePath,
  taskBranchName: task.taskBranchName,
  taskBranchManagement: task.taskBranchManagement,
  baseBranchName: task.baseBranchName,
  reviewMergePolicy: task.reviewMergePolicy,
  canMergeAfterReview: canMergeAfterReview(task.reviewMergePolicy),
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  mode: task.mode,
  lifecycleState: task.lifecycleState,
  runtimeState: task.runtimeState,
  workspaceStatus: task.workspaceStatus,
  mergeStatus: task.mergeStatus,
  mergeFailureReason: task.mergeFailureReason,
  mergeMessage: task.mergeMessage,
  latestAutoCheckResult: task.latestAutoCheckResult,
});

const toTaskStateUpdate = (
  event: Extract<TaskEvent, { type: 'taskLifecycleStateChanged' }>,
): TaskStateUpdate => ({
  taskId: event.taskId,
  sessionId: event.sessionId,
  lifecycleState: event.state,
  mode: event.mode,
  updatedAt: event.timestamp,
  projectWorkspacePath: event.projectWorkspacePath,
  taskWorkspacePath: event.taskWorkspacePath,
  taskBranchName: event.taskBranchName,
  taskBranchManagement: event.taskBranchManagement,
  baseBranchName: event.baseBranchName,
  reviewMergePolicy: event.reviewMergePolicy,
  canMergeAfterReview: event.reviewMergePolicy
    ? canMergeAfterReview(event.reviewMergePolicy)
    : undefined,
  workspaceStatus: event.workspaceStatus,
  mergeStatus: event.mergeStatus,
  mergeFailureReason: event.mergeFailureReason,
  mergeMessage: event.mergeMessage,
  clearMergeFailure: shouldClearMergeFailure({
    workspaceStatus: event.workspaceStatus,
    mergeStatus: event.mergeStatus,
  }),
  latestAutoCheckResult: event.autoCheckResult,
});

// eslint-disable-next-line no-grouped-exports/no-exported-function-object -- Existing service object; clean up separately.
export const taskViewStateService = {
  toUiTask,
  toTaskStateUpdate,
};
