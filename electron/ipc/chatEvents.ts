import type { RequestPermissionRequest, SessionUpdate } from 'cline';
import type { TaskEvent, TaskSummary } from '../../core/chat.js';
import type { TaskRecord } from '../entity/chat.js';

const now = () => new Date().toISOString();

export const toTaskSummary = (task: TaskRecord): TaskSummary => ({
  taskId: task.taskId,
  sessionId: task.sessionId,
  cwd: task.cwd,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  mode: task.mode,
  state: task.state,
});

export const createTaskStartedEvent = (task: TaskRecord): TaskEvent => ({
  type: 'taskStarted',
  task: toTaskSummary(task),
  timestamp: now(),
});

export const createErrorEvent = (message: string, sessionId?: string, taskId?: string): TaskEvent => ({
  type: 'error',
  taskId,
  sessionId,
  timestamp: now(),
  message,
});

export const createRawSessionUpdateEvent = (taskId: string, sessionId: string, update: SessionUpdate): TaskEvent => ({
  type: 'sessionUpdate',
  taskId,
  sessionId,
  timestamp: now(),
  update,
});

export const createSessionTurnUpdateEvent = (taskId: string, sessionId: string, turnId: string | undefined, update: SessionUpdate): TaskEvent => ({
  type: 'sessionUpdate',
  taskId,
  sessionId,
  turnId,
  timestamp: now(),
  update,
});

export const createPermissionRequestEvent = (taskId: string, sessionId: string, turnId: string, approvalId: string, request: RequestPermissionRequest): TaskEvent => ({
  type: 'permissionRequest',
  taskId,
  sessionId,
  turnId,
  timestamp: now(),
  approvalId,
  request,
});

export const createHumanDecisionRequestEvent = (
  taskId: string,
  sessionId: string,
  turnId: string,
  requestId: string,
  title: string,
  description?: string,
  schema?: unknown,
): TaskEvent => ({
  type: 'humanDecisionRequest',
  taskId,
  sessionId,
  turnId,
  timestamp: now(),
  requestId,
  title,
  description,
  schema,
});

export const createAssistantMessageCompletedEvent = (taskId: string, sessionId: string, turnId: string, reason?: string): TaskEvent => ({
  type: 'assistantMessageCompleted',
  taskId,
  sessionId,
  turnId,
  timestamp: now(),
  reason,
});

export const createTaskStateChangedEvent = (taskId: string, sessionId: string, turnId: string | undefined, state: TaskSummary['state'], reason?: string): TaskEvent => ({
  type: 'taskStateChanged',
  taskId,
  sessionId,
  turnId,
  timestamp: now(),
  state,
  reason,
});
