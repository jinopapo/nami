type TaskMode = 'plan' | 'act';

export type ToolPermissionRequest = {
  sessionId: string;
  toolName: string;
  input: unknown;
  title: string;
  options: Array<{
    optionId: 'allow_once' | 'reject_once' | string;
    kind: 'allow' | 'reject' | string;
    name: string;
  }>;
};

export type ToolPermissionResponse = {
  approved: boolean;
  reason?: string;
};

export type ToolKind =
  | 'read'
  | 'edit'
  | 'delete'
  | 'move'
  | 'search'
  | 'execute'
  | 'think'
  | 'fetch'
  | 'switch_mode'
  | 'other';

type SessionUpdate =
  | {
      sessionUpdate: 'agent_message_chunk';
      content: { type: 'text' | 'reasoning'; text: string };
      text?: string;
    }
  | {
      sessionUpdate: 'agent_thought_chunk';
      content: { type: 'reasoning'; text: string };
      text?: string;
    }
  | {
      sessionUpdate: 'tool_call' | 'tool_call_update';
      toolCallId?: string;
      kind?:
        | 'read'
        | 'edit'
        | 'delete'
        | 'move'
        | 'search'
        | 'execute'
        | 'think'
        | 'fetch'
        | 'switch_mode'
        | 'other'
        | string
        | null;
      title?: string | null;
      status?: string | null;
      rawInput?: unknown;
      rawOutput?: unknown;
      content?: unknown[];
      locations?: unknown[];
    }
  | {
      sessionUpdate: 'plan';
      entries?: Array<{ content: string; status?: string }>;
      content?: unknown;
    }
  | {
      sessionUpdate: 'current_mode_update';
      currentModeId: 'plan' | 'act';
    }
  | {
      sessionUpdate:
        | 'user_message_chunk'
        | 'available_commands_update'
        | 'config_option_update'
        | 'session_info_update';
      [key: string]: unknown;
    };

export type ToolCallSessionUpdate = Extract<
  SessionUpdate,
  { sessionUpdate: 'tool_call' | 'tool_call_update' }
>;

export type SessionEvent =
  | { type: 'session-update'; update: SessionUpdate }
  | { type: 'session-ended'; stopReason?: string; error?: string };

type TaskRuntimeState =
  | 'idle'
  | 'running'
  | 'waiting_permission'
  | 'waiting_human_decision'
  | 'aborted'
  | 'completed'
  | 'error';

type TaskLifecycleState =
  | 'waiting_dependencies'
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
  | 'merge_skipped'
  | 'merge_failed';

type TaskMergeStatus = 'idle' | 'running' | 'succeeded' | 'failed';

type TaskBranchManagement = 'system_managed' | 'user_managed';

type TaskReviewMergePolicy = 'merge_to_base' | 'preserve_branch';

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
  taskBranchManagement: TaskBranchManagement;
  baseBranchName: string;
  reviewMergePolicy: TaskReviewMergePolicy;
  createdAt: string;
  updatedAt: string;
  mode: TaskMode;
  lifecycleState: TaskLifecycleState;
  runtimeState: TaskRuntimeState;
  workspaceStatus: TaskWorkspaceStatus;
  mergeStatus: TaskMergeStatus;
  mergeFailureReason?: TaskMergeFailureReason;
  mergeMessage?: string;
  dependencyTaskIds: string[];
  pendingDependencyTaskIds: string[];
  latestAutoCheckResult?: AutoCheckResult;
};

type TaskTurnRecord = {
  turnId: string;
  prompt?: string;
  state: 'submitting' | TaskRuntimeState;
  startedAt: string;
  endedAt?: string;
  reason?: string;
};

export type PendingApproval = {
  taskId: string;
  sessionId: string;
  turnId: string;
  resolve: (response: { approved: boolean; reason?: string }) => void;
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
