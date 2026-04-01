import type { ChatRuntimeState } from './chat.js';

// ts-prune-ignore-next
export const TASK_CHANNELS = {
  create: 'task:create',
  transitionLifecycle: 'task:transitionLifecycle',
  selectDirectory: 'task:selectDirectory',
  getLastSelectedWorkspace: 'task:getLastSelectedWorkspace',
  subscribeEvent: 'task:event',
} as const;

export type TaskLifecycleState = 'planning' | 'awaiting_confirmation' | 'executing' | 'awaiting_review' | 'completed';

export type TaskSummary = {
  taskId: string;
  sessionId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  lifecycleState: TaskLifecycleState;
  runtimeState: ChatRuntimeState;
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