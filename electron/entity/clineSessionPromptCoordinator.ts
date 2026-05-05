type ChatRuntimeState =
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

type AutoCheckRunSummary = {
  autoCheckRunId: string;
  steps: AutoCheckStep[];
};

type AutoCheckStepEvent = {
  autoCheckRunId: string;
  stepId: string;
  name: string;
  command: string;
  phase: 'started' | 'finished';
  success?: boolean;
  exitCode?: number;
  output?: string;
  ranAt?: string;
};

type AutoCheckFeedbackEvent = {
  autoCheckRunId: string;
  stepId: string;
  name: string;
  command: string;
  exitCode: number;
  output: string;
  prompt: string;
};

type AutoApprovalConfig = {
  enabled: boolean;
};

type RuntimeTaskSession = {
  sessionId: string;
  mode: string;
};

type RuntimeTask = {
  taskId: string;
  sessionId: string;
  cwd: string;
  projectWorkspacePath: string;
  taskWorkspacePath: string;
  taskBranchName: string;
  taskBranchManagement: TaskBranchManagement;
  baseBranchName: string;
  reviewMergePolicy: TaskReviewMergePolicy;
  mode: 'plan' | 'act';
  lifecycleState: TaskLifecycleState;
  runtimeState: ChatRuntimeState;
  workspaceStatus: TaskWorkspaceStatus;
  mergeStatus: TaskMergeStatus;
  mergeFailureReason?: TaskMergeFailureReason;
  mergeMessage?: string;
  updatedAt: string;
  activeTurnId?: string;
  turns: Array<{
    turnId: string;
    prompt?: string;
    state: 'submitting' | ChatRuntimeState;
    reason?: string;
  }>;
};

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type PromptInput = {
  taskId: string;
  sessionId: string;
  turnId: string;
  prompt: string;
};

type PostPromptResolution =
  | { kind: 'none' }
  | {
      kind: 'transition';
      lifecycleState: TaskLifecycleState;
      reason: string;
    }
  | {
      kind: 'execution-completed';
      reason?: string;
    };

export type AgentServicePort = {
  prompt(input: {
    sessionId: string;
    prompt: string;
  }): Promise<{ stopReason?: string }>;
  getSession(sessionId: string): { mode: string };
  setSessionMode(input: {
    sessionId: string;
    modeId: 'plan' | 'act';
  }): Promise<unknown>;
};

export type RuntimeServicePort = {
  updateRuntimeState(
    taskId: string,
    state: ChatRuntimeState,
    reason?: string,
    turnId?: string,
  ): RuntimeTask;
  completeTurn(
    taskId: string,
    turnId: string,
    state: ChatRuntimeState,
    reason?: string,
  ): RuntimeTask;
  getTask(taskId: string): RuntimeTask;
  updateTaskMode(taskId: string, mode: 'plan' | 'act'): RuntimeTask;
  updateTaskSession(taskId: string, session: RuntimeTaskSession): RuntimeTask;
  updateLifecycleState(
    taskId: string,
    state: TaskLifecycleState,
    reason?: string,
    autoCheckResult?: AutoCheckResult,
  ): RuntimeTask;
  updateTaskWorkspace(
    taskId: string,
    workspace: Partial<{
      cwd: string;
      projectWorkspacePath: string;
      taskWorkspacePath: string;
      taskBranchName: string;
      taskBranchManagement: TaskBranchManagement;
      baseBranchName: string;
      reviewMergePolicy: TaskReviewMergePolicy;
      workspaceStatus: TaskWorkspaceStatus;
      mergeStatus: TaskMergeStatus;
      mergeFailureReason?: TaskMergeFailureReason;
      mergeMessage?: string;
    }>,
  ): RuntimeTask;
  beginTurn(taskId: string, prompt?: string): { turnId: string };
  expectedModeFor(taskId: string): 'plan' | 'act' | undefined;
};

export type LifecycleServicePort = {
  shouldSyncAfterPrompt(stopReason?: string): boolean;
  resolvePostPrompt(
    task: RuntimeTask,
    stopReason?: string,
  ): PostPromptResolution;
};

export type AutoCheckCoordinatorPort = {
  handleExecutionCompleted(input: {
    taskId: string;
    reason?: string;
    emitLifecycleStateChanged: (
      taskId: string,
      sessionId: string,
      state: TaskLifecycleState,
      reason?: string,
      mode?: 'plan' | 'act',
      autoCheckResult?: AutoCheckResult,
    ) => void;
    emitAutoCheckStarted: (
      taskId: string,
      sessionId: string,
      run: AutoCheckRunSummary,
    ) => void;
    emitAutoCheckStep: (
      taskId: string,
      sessionId: string,
      step: AutoCheckStepEvent,
    ) => void;
    emitAutoCheckCompleted: (
      taskId: string,
      sessionId: string,
      autoCheckRunId: string,
      result: AutoCheckResult,
    ) => void;
    emitAutoCheckFeedbackPrepared: (
      taskId: string,
      sessionId: string,
      feedback: AutoCheckFeedbackEvent,
    ) => void;
    beginTurn: (taskId: string, prompt?: string) => { turnId: string };
    runPrompt: (input: PromptInput) => void;
  }): Promise<void>;
};

export type AutoApprovalServicePort = {
  getConfig(cwd: string): Promise<AutoApprovalConfig>;
};
