import type { CoreSessionEvent } from '@cline/sdk';

export type ClineSdkCoreSessionEventResource = CoreSessionEvent;

export type ClineSdkToolApprovalRequestResource = {
  sessionId: string;
  toolName: string;
  input: unknown;
};

export type ClineSdkAgentRuntimeEventResource = {
  type: string;
  contentType?: string;
  text?: string;
  accumulatedText?: string;
  delta?: string;
  finishReason?: string;
  error?: unknown;
  id?: string;
  name?: string;
  toolName?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  durationMs?: number;
  toolCall?: {
    toolCallId?: string;
    toolName?: string;
    input?: unknown;
  };
  message?: {
    content?: unknown;
  };
  result?: {
    status?: string;
    finishReason?: string;
    outputText?: string;
    error?: unknown;
  };
  update?: unknown;
};
