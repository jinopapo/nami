import type { RequestPermissionRequest, SessionUpdate } from 'cline';

// ts-prune-ignore-next
export const CHAT_CHANNELS = {
  startTask: 'chat:startTask',
  sendMessage: 'chat:sendMessage',
  abortTask: 'chat:abortTask',
  resumeTask: 'chat:resumeTask',
  selectDirectory: 'chat:selectDirectory',
  subscribeEvent: 'chat:event',
} as const;

type TaskState =
  | 'running'
  | 'waiting_permission'
  | 'waiting_human_decision'
  | 'aborted'
  | 'completed'
  | 'error';

export type TaskSummary = {
  taskId: string;
  sessionId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  state: TaskState;
};

export type TaskEvent =
  | {
      type: 'sessionUpdate';
      taskId: string;
      sessionId: string;
      turnId?: string;
      timestamp: string;
      update: SessionUpdate;
    }
  | {
      type: 'permissionRequest';
      taskId: string;
      sessionId: string;
      turnId: string;
      timestamp: string;
      approvalId: string;
      request: RequestPermissionRequest;
    }
  | {
      type: 'humanDecisionRequest';
      taskId: string;
      sessionId: string;
      turnId: string;
      timestamp: string;
      requestId: string;
      title: string;
      description?: string;
      schema?: unknown;
    }
  | {
      type: 'assistantMessageCompleted';
      taskId: string;
      sessionId: string;
      turnId: string;
      timestamp: string;
      reason?: string;
    }
  | {
      type: 'taskStateChanged';
      taskId: string;
      sessionId: string;
      turnId?: string;
      timestamp: string;
      state: TaskState;
      reason?: string;
    }
  | {
      type: 'taskStarted';
      task: TaskSummary;
      timestamp: string;
    }
  | {
      type: 'error';
      taskId?: string;
      sessionId?: string;
      timestamp: string;
      message: string;
    };

export type StartTaskInput = {
  cwd?: string;
  prompt: string;
};

export type StartTaskResult = {
  taskId: string;
  sessionId: string;
  turnId: string;
};

export type SendMessageInput = {
  taskId: string;
  prompt: string;
};

export type SendMessageResult = {
  taskId: string;
  sessionId: string;
  turnId: string;
};

export type AbortTaskInput = {
  taskId: string;
};

export type ResumeTaskInput = {
  taskId: string;
  reason: 'permission' | 'human_decision' | 'resume';
  payload?: {
    approvalId?: string;
    decision?: 'approve' | 'reject';
    requestId?: string;
    value?: unknown;
  };
};

export type SelectDirectoryInput = {
  defaultPath?: string;
};

export type SelectDirectoryResult = {
  path?: string;
};
