import type { ChatRuntimeState } from '../../core/chat.js';
import type { AutoCheckResult, TaskLifecycleState } from '../../core/task.js';

export type TaskRecord = {
  taskId: string;
  sessionId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  lifecycleState: TaskLifecycleState;
  runtimeState: ChatRuntimeState;
  latestAutoCheckResult?: AutoCheckResult;
};

export type TaskTurnRecord = {
  turnId: string;
  state: 'submitting' | ChatRuntimeState;
  startedAt: string;
  endedAt?: string;
  reason?: string;
};
