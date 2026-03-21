import type { TaskSummary } from '../../core/chat.js';

export type TaskRecord = {
  taskId: string;
  sessionId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  state: TaskSummary['state'];
};

export type TaskTurnRecord = {
  turnId: string;
  state: 'submitting' | TaskSummary['state'];
  startedAt: string;
  endedAt?: string;
  reason?: string;
};
