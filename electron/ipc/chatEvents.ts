import type { RequestPermissionRequest, SessionUpdate } from 'cline';
import type { ChatEvent, ChatRuntimeState } from '../../core/chat.js';
import type { TaskRecord } from '../entity/chat.js';

const now = () => new Date().toISOString();

export const createErrorEvent = (message: string, sessionId?: string, taskId?: string): ChatEvent => ({
  type: 'error',
  taskId,
  sessionId,
  timestamp: now(),
  message,
});

export const createRawSessionUpdateEvent = (taskId: string, sessionId: string, update: SessionUpdate): ChatEvent => ({
  type: 'sessionUpdate',
  taskId,
  sessionId,
  timestamp: now(),
  update,
});

export const createSessionTurnUpdateEvent = (taskId: string, sessionId: string, turnId: string | undefined, update: SessionUpdate): ChatEvent => ({
  type: 'sessionUpdate',
  taskId,
  sessionId,
  turnId,
  timestamp: now(),
  update,
});

export const createPermissionRequestEvent = (taskId: string, sessionId: string, turnId: string, approvalId: string, request: RequestPermissionRequest): ChatEvent => ({
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
): ChatEvent => ({
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

export const createAssistantMessageCompletedEvent = (taskId: string, sessionId: string, turnId: string, reason?: string): ChatEvent => ({
  type: 'assistantMessageCompleted',
  taskId,
  sessionId,
  turnId,
  timestamp: now(),
  reason,
});

export const createChatRuntimeStateChangedEvent = (taskId: string, sessionId: string, turnId: string | undefined, state: ChatRuntimeState, reason?: string): ChatEvent => ({
  type: 'chatRuntimeStateChanged',
  taskId,
  sessionId,
  turnId,
  timestamp: now(),
  state,
  reason,
});
