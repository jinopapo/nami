import type { TaskState } from '../../core/chat.js';

export type TaskRecord = {
  taskId: string;
  sessionId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  state: TaskState;
};
