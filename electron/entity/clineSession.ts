import type { RequestPermissionResponse } from 'cline';
import type { ChatRuntimeState } from '../../core/chat.js';
import type {
  AutoCheckConfig,
  AutoCheckResult,
  TaskLifecycleState,
} from '../../core/task.js';

type TaskRecord = {
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

export type PendingApproval = {
  taskId: string;
  sessionId: string;
  turnId: string;
  resolve: (response: RequestPermissionResponse) => void;
};

type PendingHumanDecision = {
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
  autoCheckConfig?: AutoCheckConfig;
};
