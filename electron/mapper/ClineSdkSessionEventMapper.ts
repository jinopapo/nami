import type {
  SessionEvent,
  ToolKind,
  ToolPermissionRequest,
  ToolCallSessionUpdate,
} from '../entity/clineSession.js';
import type {
  ClineSdkAgentRuntimeEventResource,
  ClineSdkCoreSessionEventResource,
  ClineSdkToolApprovalRequestResource,
} from '../resource/clineSdkSession.js';

type SessionUpdate = Extract<
  SessionEvent,
  { type: 'session-update' }
>['update'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const extractClineSdkSessionId = (
  event: ClineSdkCoreSessionEventResource,
): string | undefined => {
  if ('payload' in event && typeof event.payload === 'object') {
    const payload = event.payload as { sessionId?: unknown };
    return typeof payload.sessionId === 'string'
      ? payload.sessionId
      : undefined;
  }

  return undefined;
};

export const mapToolNameToToolKind = (toolName: string): ToolKind => {
  switch (toolName) {
    case 'read_files':
      return 'read';
    case 'editor':
    case 'apply_patch':
      return 'edit';
    case 'bash':
      return 'execute';
    case 'search':
      return 'search';
    case 'fetch_web':
      return 'fetch';
    default:
      return 'other';
  }
};

export const mapFinishReasonToStopReason = (
  finishReason?: string,
): string | undefined => {
  if (!finishReason) {
    return undefined;
  }

  return finishReason === 'aborted' ? 'cancelled' : finishReason;
};

const stringifyError = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }

  return undefined;
};

export const isToolCallSessionUpdate = (
  update: SessionUpdate,
): update is ToolCallSessionUpdate =>
  update.sessionUpdate === 'tool_call' ||
  update.sessionUpdate === 'tool_call_update';

export const mapToolApprovalRequestToPermissionRequest = (
  request: ClineSdkToolApprovalRequestResource,
): ToolPermissionRequest => ({
  sessionId: request.sessionId,
  toolName: request.toolName,
  input: request.input,
  title: `${request.toolName} の実行許可`,
  options: [
    { optionId: 'allow_once', kind: 'allow', name: '許可' },
    { optionId: 'reject_once', kind: 'reject', name: '拒否' },
  ],
});

const mapChunkEvent = (
  event: Extract<ClineSdkCoreSessionEventResource, { type: 'chunk' }>,
): SessionEvent | undefined => {
  if (event.payload.stream !== 'agent') {
    return undefined;
  }

  return {
    type: 'session-update',
    update: {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: event.payload.chunk },
      text: event.payload.chunk,
    },
  };
};

const getToolCallOutput = (
  message: ClineSdkAgentRuntimeEventResource['message'],
) => {
  if (!Array.isArray(message?.content)) {
    return undefined;
  }

  return message.content
    .filter(isRecord)
    .find((content) => content.type === 'tool-result')?.output;
};

const mapAgentRuntimeEvent = (
  agentEvent: ClineSdkAgentRuntimeEventResource,
): SessionEvent | undefined => {
  switch (agentEvent.type) {
    case 'assistant-text-delta':
      return typeof agentEvent.text === 'string'
        ? {
            type: 'session-update',
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text: agentEvent.text },
              text: agentEvent.text,
            },
          }
        : undefined;
    case 'assistant-reasoning-delta':
      return typeof agentEvent.text === 'string'
        ? {
            type: 'session-update',
            update: {
              sessionUpdate: 'agent_thought_chunk',
              content: { type: 'reasoning', text: agentEvent.text },
              text: agentEvent.text,
            },
          }
        : undefined;
    case 'tool-started': {
      const toolName = agentEvent.toolCall?.toolName ?? 'unknown_tool';
      return {
        type: 'session-update',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: agentEvent.toolCall?.toolCallId,
          kind: mapToolNameToToolKind(toolName),
          title: toolName,
          status: 'processing',
          rawInput: agentEvent.toolCall?.input,
        },
      };
    }
    case 'tool-updated': {
      const toolName = agentEvent.toolCall?.toolName ?? 'unknown_tool';
      return {
        type: 'session-update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: agentEvent.toolCall?.toolCallId,
          kind: mapToolNameToToolKind(toolName),
          title: toolName,
          status: 'processing',
          rawInput: agentEvent.toolCall?.input,
          rawOutput: agentEvent.update,
        },
      };
    }
    case 'tool-finished': {
      const toolName = agentEvent.toolCall?.toolName ?? 'unknown_tool';
      return {
        type: 'session-update',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: agentEvent.toolCall?.toolCallId,
          kind: mapToolNameToToolKind(toolName),
          title: toolName,
          status: 'completed',
          rawInput: agentEvent.toolCall?.input,
          rawOutput: getToolCallOutput(agentEvent.message),
        },
      };
    }
    case 'assistant-message':
      return {
        type: 'session-ended',
        stopReason: mapFinishReasonToStopReason(agentEvent.finishReason),
      };
    case 'run-finished':
      return {
        type: 'session-ended',
        stopReason: mapFinishReasonToStopReason(agentEvent.result?.status),
      };
    case 'run-failed':
      return {
        type: 'session-ended',
        stopReason: 'error',
        error:
          stringifyError(agentEvent.error) ??
          stringifyError(agentEvent.result?.error),
      };
    default:
      return undefined;
  }
};

export const mapCoreSessionEvent = (
  event: ClineSdkCoreSessionEventResource,
): SessionEvent | undefined => {
  switch (event.type) {
    case 'chunk':
      return mapChunkEvent(event);
    case 'agent_event':
      return mapAgentRuntimeEvent(
        event.payload.event as ClineSdkAgentRuntimeEventResource,
      );
    case 'ended':
      return {
        type: 'session-ended',
        stopReason: mapFinishReasonToStopReason(event.payload.reason),
      };
    case 'status':
      return undefined;
    case 'hook':
      return undefined;
    case 'pending_prompts':
      return undefined;
    case 'pending_prompt_submitted':
      return undefined;
    case 'session_snapshot':
      return undefined;
    case 'team_progress':
      return undefined;
    default:
      return undefined;
  }
};
