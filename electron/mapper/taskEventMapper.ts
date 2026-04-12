import type {
  AutoCheckFeedbackEvent,
  AutoCheckResult,
  AutoCheckRunSummary,
  AutoCheckStepEvent,
  TaskEvent,
  TaskLifecycleState,
  TaskSummary,
} from '../../share/task.js';
import type { TaskRuntime } from '../entity/clineSession.js';

type TaskRecordSnapshot = Pick<
  TaskRuntime,
  | 'taskId'
  | 'sessionId'
  | 'cwd'
  | 'projectWorkspacePath'
  | 'taskWorkspacePath'
  | 'taskBranchName'
  | 'baseBranchName'
  | 'createdAt'
  | 'updatedAt'
  | 'mode'
  | 'lifecycleState'
  | 'runtimeState'
  | 'workspaceStatus'
  | 'mergeStatus'
  | 'mergeFailureReason'
  | 'mergeMessage'
  | 'latestAutoCheckResult'
>;

type WorkspaceEventPayload = {
  projectWorkspacePath?: string;
  taskWorkspacePath?: string;
  taskBranchName?: string;
  baseBranchName?: string;
  workspaceStatus?: TaskSummary['workspaceStatus'];
  mergeStatus?: TaskSummary['mergeStatus'];
  mergeFailureReason?: TaskSummary['mergeFailureReason'];
  mergeMessage?: TaskSummary['mergeMessage'];
};

const now = () => new Date().toISOString();

// ts-prune-ignore-next
const toTaskSummary = (task: TaskRecordSnapshot): TaskSummary => ({
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

export const toWorkspaceEventPayload = (
  task: Pick<
    TaskRuntime,
    | 'projectWorkspacePath'
    | 'taskWorkspacePath'
    | 'taskBranchName'
    | 'baseBranchName'
    | 'workspaceStatus'
    | 'mergeStatus'
    | 'mergeFailureReason'
    | 'mergeMessage'
  >,
): WorkspaceEventPayload => ({
  projectWorkspacePath: task.projectWorkspacePath,
  taskWorkspacePath: task.taskWorkspacePath,
  taskBranchName: task.taskBranchName,
  baseBranchName: task.baseBranchName,
  workspaceStatus: task.workspaceStatus,
  mergeStatus: task.mergeStatus,
  mergeFailureReason: task.mergeFailureReason,
  mergeMessage: task.mergeMessage,
});

export const createTaskCreatedEvent = (
  task: TaskRecordSnapshot,
): TaskEvent => ({
  type: 'taskCreated',
  task: toTaskSummary(task),
  timestamp: now(),
});

export const createTaskLifecycleStateChangedEvent = (
  taskId: string,
  sessionId: string,
  state: TaskLifecycleState,
  reason?: string,
  mode?: 'plan' | 'act',
  workspace?: WorkspaceEventPayload,
  autoCheckResult?: TaskSummary['latestAutoCheckResult'],
): TaskEvent => ({
  type: 'taskLifecycleStateChanged',
  taskId,
  sessionId,
  timestamp: now(),
  state,
  mode,
  reason,
  projectWorkspacePath: workspace?.projectWorkspacePath,
  taskWorkspacePath: workspace?.taskWorkspacePath,
  taskBranchName: workspace?.taskBranchName,
  baseBranchName: workspace?.baseBranchName,
  workspaceStatus: workspace?.workspaceStatus,
  mergeStatus: workspace?.mergeStatus,
  mergeFailureReason: workspace?.mergeFailureReason,
  mergeMessage: workspace?.mergeMessage,
  autoCheckResult,
});

export const createAutoCheckStartedEvent = (
  taskId: string,
  sessionId: string,
  run: AutoCheckRunSummary,
): TaskEvent => ({
  type: 'autoCheckStarted',
  taskId,
  sessionId,
  timestamp: now(),
  run,
});

export const createAutoCheckStepEvent = (
  taskId: string,
  sessionId: string,
  step: AutoCheckStepEvent,
): TaskEvent => ({
  type: 'autoCheckStep',
  taskId,
  sessionId,
  timestamp: now(),
  step,
});

export const createAutoCheckCompletedEvent = (
  taskId: string,
  sessionId: string,
  autoCheckRunId: string,
  result: AutoCheckResult,
): TaskEvent => ({
  type: 'autoCheckCompleted',
  taskId,
  sessionId,
  timestamp: now(),
  autoCheckRunId,
  result,
});

export const createAutoCheckFeedbackPreparedEvent = (
  taskId: string,
  sessionId: string,
  feedback: AutoCheckFeedbackEvent,
): TaskEvent => ({
  type: 'autoCheckFeedbackPrepared',
  taskId,
  sessionId,
  timestamp: now(),
  feedback,
});
