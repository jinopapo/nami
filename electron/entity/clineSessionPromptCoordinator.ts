/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_entity'. Dependency is of type 'share' */
import type { ChatRuntimeState } from '../../share/chat.js';
import type {
  AutoCheckFeedbackEvent,
  AutoCheckResult,
  AutoCheckRunSummary,
  AutoCheckStepEvent,
  TaskBranchManagement,
  TaskMergeFailureReason,
  TaskMergeStatus,
  TaskLifecycleState,
  TaskReviewMergePolicy,
  TaskWorkspaceStatus,
} from '../../share/task.js';

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
