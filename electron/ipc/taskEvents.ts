import type { TaskEvent, TaskSummary, TaskLifecycleState } from '../../core/task.js';
import type { TaskRecord } from '../entity/chat.js';

const now = () => new Date().toISOString();

export const toTaskSummary = (task: TaskRecord): TaskSummary => ({
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

export const createTaskCreatedEvent = (task: TaskRecord): TaskEvent => ({
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