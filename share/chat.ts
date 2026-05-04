import type { RequestPermissionRequest, SessionUpdate } from 'cline';

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type ChatRuntimeState =
  | 'idle'
  | 'running'
  | 'waiting_permission'
  | 'waiting_human_decision'
  | 'aborted'
  | 'completed'
  | 'error';

export type ChatEvent =
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
      type: 'chatRuntimeStateChanged';
      taskId: string;
      sessionId: string;
      turnId?: string;
      timestamp: string;
      state: ChatRuntimeState;
      reason?: string;
    }
  | {
      type: 'error';
      taskId?: string;
      sessionId?: string;
      timestamp: string;
      message: string;
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
