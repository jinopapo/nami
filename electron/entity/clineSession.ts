import type { RequestPermissionResponse } from 'cline';
import type { TaskRecord, TaskTurnRecord } from './chat.js';

export type PendingApproval = {
  taskId: string;
  sessionId: string;
  turnId: string;
  resolve: (response: RequestPermissionResponse) => void;
};

export type PendingHumanDecision = {
  turnId: string;
  requestId: string;
  title: string;
  description?: string;
  schema?: unknown;
  resolve: (value: unknown) => void;
};

export type TaskRuntime = TaskRecord & {
  activeTurnId?: string;
  turns: TaskTurnRecord[];
  pendingHumanDecision?: PendingHumanDecision;
};