import type { TaskSummary, TaskEvent } from '../../core/task';
import type { UiTask } from '../model/chat';

type AutoCheckResult = UiTask['latestAutoCheckResult'];

type TaskStateUpdate = {
  taskId: string;
  lifecycleState?: UiTask['lifecycleState'];
  runtimeState?: UiTask['runtimeState'];
  mode?: UiTask['mode'];
  updatedAt?: string;
  projectWorkspacePath?: UiTask['projectWorkspacePath'];
  taskWorkspacePath?: UiTask['taskWorkspacePath'];
  taskBranchName?: UiTask['taskBranchName'];
  baseBranchName?: UiTask['baseBranchName'];
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
}) => input.workspaceStatus === 'merged' || input.mergeStatus === 'succeeded';

const toUiTask = (task: TaskSummary): UiTask => ({
  taskId: task.taskId,
  sessionId: task.sessionId,
  cwd: task.cwd,
  projectWorkspacePath: task.projectWorkspacePath,
  taskWorkspacePath: task.taskWorkspacePath,
  taskBranchName: task.taskBranchName,
  baseBranchName: task.baseBranchName,
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
  lifecycleState: event.state,
  mode: event.mode,
  updatedAt: event.timestamp,
  projectWorkspacePath: event.projectWorkspacePath,
  taskWorkspacePath: event.taskWorkspacePath,
  taskBranchName: event.taskBranchName,
  baseBranchName: event.baseBranchName,
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

export const taskViewStateService = {
  toUiTask,
  toTaskStateUpdate,
};
