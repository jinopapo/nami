import type { RequestPermissionRequest, SessionUpdate } from 'cline';

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue | undefined };
type JsonArray = JsonValue[];

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

type ToolCallPhase = 'start' | 'update' | 'complete' | 'error';

export type ToolCallLog = {
  toolCallId?: string;
  toolKind: ToolKind;
  title: string;
  phase: ToolCallPhase;
  status?: string;
  statusLabel: string;
  rawInput?: JsonValue;
  rawOutput?: JsonValue;
  inputSummary?: JsonObject;
  outputSummary?: JsonObject;
  metadata?: JsonObject;
};

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
