import type { CoreSessionEvent } from '@cline/sdk';

export type ClineSdkCoreSessionEventResource = CoreSessionEvent;

export type ClineSdkToolApprovalRequestResource = {
  sessionId: string;
  toolName: string;
  input: unknown;
};

export type ClineSdkAgentRuntimeEventResource = {
  type: string;
  text?: string;
  accumulatedText?: string;
  finishReason?: string;
  error?: unknown;
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
