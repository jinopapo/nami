import type { RequestPermissionResponse } from 'cline';

type TaskMode = 'plan' | 'act';

type TaskRuntimeState =
  | 'idle'
  | 'running'
  | 'waiting_permission'
  | 'waiting_human_decision'
  | 'aborted'
  | 'completed'
  | 'error';

type TaskLifecycleState =
  | 'before_start'
  | 'planning'
  | 'awaiting_confirmation'
  | 'executing'
  | 'auto_checking'
  | 'awaiting_review'
  | 'completed';

type TaskWorkspaceStatus =
  | 'initializing'
  | 'initialization_failed'
  | 'ready'
  | 'merge_pending'
  | 'merged'
  | 'merge_failed';

type TaskMergeStatus = 'idle' | 'running' | 'succeeded' | 'failed';

type TaskMergeFailureReason =
  | 'conflict'
  | 'hook_failed'
  | 'worktrunk_unavailable'
  | 'not_git_repository'
  | 'command_failed'
  | 'unknown';

type AutoCheckStep = {
  id: string;
  name: string;
  command: string;
};

type AutoCheckConfig = {
  enabled: boolean;
  steps: AutoCheckStep[];
};

type AutoCheckStepResult = {
  stepId: string;
  name: string;
  command: string;
  success: boolean;
  exitCode: number;
  output: string;
  ranAt: string;
};

type AutoCheckResult = {
  success: boolean;
  exitCode: number;
  output: string;
  command: string;
  ranAt: string;
  steps: AutoCheckStepResult[];
  failedStep?: AutoCheckStepResult;
};

type TaskRecord = {
  taskId: string;
  sessionId: string;
  cwd: string;
  projectWorkspacePath: string;
  taskWorkspacePath: string;
  taskBranchName: string;
  baseBranchName: string;
  createdAt: string;
  updatedAt: string;
  mode: TaskMode;
  lifecycleState: TaskLifecycleState;
  runtimeState: TaskRuntimeState;
  workspaceStatus: TaskWorkspaceStatus;
  mergeStatus: TaskMergeStatus;
  mergeFailureReason?: TaskMergeFailureReason;
  mergeMessage?: string;
  latestAutoCheckResult?: AutoCheckResult;
};

export type TaskTurnRecord = {
  turnId: string;
  state: 'submitting' | TaskRuntimeState;
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
  initialPrompt: string;
  activeTurnId?: string;
  turns: TaskTurnRecord[];
  pendingHumanDecision?: PendingHumanDecision;
  autoCheckConfig?: AutoCheckConfig;
};
