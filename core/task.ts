import type { ChatRuntimeState } from './chat.js';

// ts-prune-ignore-next
export const TASK_CHANNELS = {
  create: 'task:create',
  transitionLifecycle: 'task:transitionLifecycle',
  selectDirectory: 'task:selectDirectory',
  getLastSelectedWorkspace: 'task:getLastSelectedWorkspace',
  getAutoCheckConfig: 'task:getAutoCheckConfig',
  saveAutoCheckConfig: 'task:saveAutoCheckConfig',
  runAutoCheck: 'task:runAutoCheck',
  subscribeEvent: 'task:event',
} as const;

export type TaskLifecycleState =
  | 'planning'
  | 'awaiting_confirmation'
  | 'executing'
  | 'auto_checking'
  | 'awaiting_review'
  | 'completed';

export type AutoCheckStep = {
  id: string;
  name: string;
  command: string;
};

export type AutoCheckConfig = {
  enabled: boolean;
  steps: AutoCheckStep[];
};

export type AutoCheckStepResult = {
  stepId: string;
  name: string;
  command: string;
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  ranAt: string;
};

export type AutoCheckResult = {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  command: string;
  ranAt: string;
  steps: AutoCheckStepResult[];
  failedStep?: AutoCheckStepResult;
};

export type TaskSummary = {
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

export type TaskEvent =
  | {
      type: 'taskCreated';
      task: TaskSummary;
      timestamp: string;
    }
  | {
      type: 'taskLifecycleStateChanged';
      taskId: string;
      sessionId: string;
      timestamp: string;
      state: TaskLifecycleState;
      mode?: 'plan' | 'act';
      reason?: string;
      autoCheckResult?: AutoCheckResult;
    };

export type CreateTaskInput = {
  cwd?: string;
  prompt: string;
};

export type CreateTaskResult = {
  taskId: string;
  sessionId: string;
  turnId: string;
};

export type TransitionTaskLifecycleInput = {
  taskId: string;
  nextState: TaskLifecycleState;
  prompt?: string;
};

export type SelectDirectoryInput = {
  defaultPath?: string;
};

export type SelectDirectoryResult = {
  path?: string;
};

export type GetLastSelectedWorkspaceResult = {
  path?: string;
};

export type GetAutoCheckConfigInput = {
  cwd: string;
};

export type GetAutoCheckConfigResult = {
  config: AutoCheckConfig;
};

export type SaveAutoCheckConfigInput = {
  cwd: string;
  config: AutoCheckConfig;
};

export type RunAutoCheckInput = {
  cwd: string;
  config?: AutoCheckConfig;
};

export type RunAutoCheckResult = {
  result: AutoCheckResult;
};
