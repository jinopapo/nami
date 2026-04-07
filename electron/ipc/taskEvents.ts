import type {
  AutoCheckFeedbackEvent,
  AutoCheckResult,
  AutoCheckRunSummary,
  AutoCheckStepEvent,
  TaskEvent,
  TaskSummary,
  TaskLifecycleState,
} from '../../core/task.js';

type TaskRecordSnapshot = {
  taskId: string;
  sessionId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  lifecycleState: TaskLifecycleState;
  runtimeState: TaskSummary['runtimeState'];
  latestAutoCheckResult?: TaskSummary['latestAutoCheckResult'];
};

const now = () => new Date().toISOString();

const toTaskSummary = (task: TaskRecordSnapshot): TaskSummary => ({
  taskId: task.taskId,
  sessionId: task.sessionId,
  cwd: task.cwd,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  mode: task.mode,
  lifecycleState: task.lifecycleState,
  runtimeState: task.runtimeState,
  latestAutoCheckResult: task.latestAutoCheckResult,
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
  autoCheckResult?: TaskSummary['latestAutoCheckResult'],
): TaskEvent => ({
  type: 'taskLifecycleStateChanged',
  taskId,
  sessionId,
  timestamp: now(),
  state,
  mode,
  reason,
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
