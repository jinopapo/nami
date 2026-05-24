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

const createAssistantTextChunkEvent = (text: string): SessionEvent => ({
  type: 'session-update',
  update: {
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text },
    text,
  },
});

const createAssistantReasoningChunkEvent = (text: string): SessionEvent => ({
  type: 'session-update',
  update: {
    sessionUpdate: 'agent_thought_chunk',
    content: { type: 'reasoning', text },
    text,
  },
});

const createProgressEvent = (input: {
  progressId?: string;
  title: string;
  status?: string;
  detail?: string;
  rawEvent?: unknown;
}): SessionEvent => ({
  type: 'session-update',
  update: {
    sessionUpdate: 'progress',
    progressId: input.progressId,
    title: input.title,
    status: input.status,
    detail: input.detail,
    rawEvent: input.rawEvent,
  },
});

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

const agentJsonLineEventTypes = new Set([
  'iteration_start',
  'content_start',
  'content_update',
  'content_delta',
  'content_end',
  'usage',
  'iteration_end',
  'done',
]);

const parseJsonLine = (line: string): unknown => {
  try {
    return JSON.parse(line) as unknown;
  } catch {
    return undefined;
  }
};

const parseAgentJsonLineEvents = (
  text: string,
): Record<string, unknown>[] | undefined => {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return undefined;
  }

  const parsedEvents = lines.map(parseJsonLine);
  if (!parsedEvents.every(isRecord)) {
    return undefined;
  }

  const records = parsedEvents.filter(isRecord);
  return records.some(
    (event) =>
      typeof event.type === 'string' && agentJsonLineEventTypes.has(event.type),
  )
    ? records
    : undefined;
};

const getAgentJsonLineEventText = (
  event: Record<string, unknown>,
): string | undefined => {
  if (
    event.contentType === 'text' &&
    (event.type === 'content_start' ||
      event.type === 'content_update' ||
      event.type === 'content_delta')
  ) {
    if (typeof event.delta === 'string') {
      return event.delta;
    }

    if (typeof event.text === 'string') {
      return event.text;
    }
  }

  return undefined;
};

const getAgentJsonLineEventProgress = (
  event: Record<string, unknown>,
): SessionEvent | undefined => {
  const type = typeof event.type === 'string' ? event.type : undefined;
  if (!type) {
    return undefined;
  }

  if (event.contentType === 'tool') {
    const toolName = typeof event.toolName === 'string' ? event.toolName : 'tool';
    const isStart = type === 'content_start';
    const isEnd = type === 'content_end';
    return {
      type: 'session-update',
      update: {
        sessionUpdate: isStart ? 'tool_call' : 'tool_call_update',
        toolCallId:
          typeof event.toolCallId === 'string' ? event.toolCallId : undefined,
        kind: mapToolNameToToolKind(toolName),
        title: toolName,
        status: isEnd ? 'completed' : 'processing',
        rawInput: event.input,
        rawOutput:
          event.output !== undefined || isEnd ? (event.output ?? event) : undefined,
      },
    };
  }

  if (type === 'usage') {
    return createProgressEvent({
      progressId: 'agent-json-line:usage',
      title: 'トークン使用量を更新中',
      status: type,
      rawEvent: event,
    });
  }

  if (type === 'iteration_start' || type === 'iteration_end') {
    return createProgressEvent({
      progressId: `agent-json-line:${type}`,
      title: type === 'iteration_start' ? '処理を開始しました' : '処理を終了しました',
      status: type,
      detail:
        typeof event.iteration === 'number'
          ? `iteration: ${event.iteration}`
          : undefined,
      rawEvent: event,
    });
  }

  if (
    type === 'content_start' ||
    type === 'content_update' ||
    type === 'content_delta' ||
    type === 'content_end'
  ) {
    return createProgressEvent({
      progressId: `agent-json-line:${type}:${String(event.contentType ?? 'unknown')}`,
      title: `コンテンツ処理中: ${String(event.contentType ?? 'unknown')}`,
      status: type,
      rawEvent: event,
    });
  }

  if (type === 'done') {
    return createProgressEvent({
      progressId: 'agent-json-line:done',
      title: '応答処理が完了しました',
      status: typeof event.reason === 'string' ? event.reason : type,
      rawEvent: event,
    });
  }

  return undefined;
};

const extractTextFromAgentJsonLines = (text: string): string | undefined => {
  const events = parseAgentJsonLineEvents(text);
  if (!events) {
    return undefined;
  }

  return events.map(getAgentJsonLineEventText).filter(Boolean).join('');
};

const extractProgressFromAgentJsonLines = (
  text: string,
): SessionEvent | undefined => {
  const events = parseAgentJsonLineEvents(text);
  if (!events) {
    return undefined;
  }

  const mappedEvents = events
    .map(getAgentJsonLineEventProgress)
    .filter((event): event is SessionEvent => Boolean(event));
  return (
    mappedEvents.find(
      (event) =>
        event.type === 'session-update' &&
        isToolCallSessionUpdate(event.update),
    ) ?? mappedEvents[0]
  );
};

const extractSessionEventsFromAgentJsonLines = (
  text: string,
): SessionEvent[] | undefined => {
  const events = parseAgentJsonLineEvents(text);
  if (!events) {
    return undefined;
  }

  const textContent = events.map(getAgentJsonLineEventText).filter(Boolean).join('');
  const textEvent = textContent
    ? [createAssistantTextChunkEvent(textContent)]
    : [];
  const nonTextEvents = events
    .filter((event) => event.contentType !== 'text')
    .map(getAgentJsonLineEventProgress)
    .filter((event): event is SessionEvent => Boolean(event));

  return [...textEvent, ...nonTextEvents];
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
  if (event.payload.stream === 'agent') {
    const text =
      extractTextFromAgentJsonLines(event.payload.chunk) ?? event.payload.chunk;

    return text
      ? createAssistantTextChunkEvent(text)
      : extractProgressFromAgentJsonLines(event.payload.chunk);
  }

  if (event.payload.type === 'text') {
    return createAssistantTextChunkEvent(event.payload.text);
  }

  if (event.payload.type === 'reasoning') {
    return createAssistantReasoningChunkEvent(event.payload.text);
  }

  return undefined;
};

const mapChunkEvents = (
  event: Extract<ClineSdkCoreSessionEventResource, { type: 'chunk' }>,
): SessionEvent[] => {
  if (event.payload.stream === 'agent') {
    const jsonLineEvents = extractSessionEventsFromAgentJsonLines(
      event.payload.chunk,
    );
    if (jsonLineEvents) {
      return jsonLineEvents;
    }

    return event.payload.chunk
      ? [createAssistantTextChunkEvent(event.payload.chunk)]
      : [];
  }

  const mapped = mapChunkEvent(event);
  return mapped ? [mapped] : [];
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

const mapAgentRuntimeToolUseEvent = (
  agentEvent: ClineSdkAgentRuntimeEventResource,
): SessionEvent | undefined => {
  if (agentEvent.contentType !== 'tool') {
    return undefined;
  }

  if (
    agentEvent.type !== 'content_start' &&
    agentEvent.type !== 'content_update' &&
    agentEvent.type !== 'content_delta' &&
    agentEvent.type !== 'content_end'
  ) {
    return undefined;
  }

  const toolName = agentEvent.toolName ?? 'tool';
  const isStart = agentEvent.type === 'content_start';
  const isEnd = agentEvent.type === 'content_end';
  return {
    type: 'session-update',
    update: {
      sessionUpdate: isStart ? 'tool_call' : 'tool_call_update',
      toolCallId: agentEvent.toolCallId,
      kind: mapToolNameToToolKind(toolName),
      title: toolName,
      status: isEnd ? 'completed' : 'processing',
      rawInput: agentEvent.input,
      rawOutput:
        agentEvent.output !== undefined || isEnd
          ? (agentEvent.output ?? agentEvent)
          : undefined,
    },
  };
};

const mapAgentRuntimeEvent = (
  agentEvent: ClineSdkAgentRuntimeEventResource,
): SessionEvent | undefined => {
  const toolUseEvent = mapAgentRuntimeToolUseEvent(agentEvent);
  if (toolUseEvent) {
    return toolUseEvent;
  }

  switch (agentEvent.type) {
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
    case 'run-finished':
      return {
        type: 'session-ended',
        stopReason: mapFinishReasonToStopReason(
          agentEvent.result?.status ?? agentEvent.result?.finishReason,
        ),
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

const getCoreEventProgressTitle = (type: string): string => {
  switch (type) {
    case 'status':
      return 'セッション状態を更新中';
    case 'hook':
      return 'フックを実行中';
    case 'pending_prompts':
      return '保留中のプロンプトを確認中';
    case 'pending_prompt_submitted':
      return '保留中のプロンプトを送信しました';
    case 'session_snapshot':
      return 'セッションスナップショットを受信しました';
    case 'team_progress':
      return 'チーム進捗を更新中';
    default:
      return `SDKイベントを受信しました: ${type}`;
  }
};

const mapCoreProgressEvent = (
  event: ClineSdkCoreSessionEventResource,
): SessionEvent => {
  const record = event as unknown as Record<string, unknown>;
  const payload = isRecord(record.payload) ? record.payload : undefined;
  return createProgressEvent({
    progressId: `core:${event.type}`,
    title: getCoreEventProgressTitle(event.type),
    status:
      payload && typeof payload.status === 'string'
        ? payload.status
        : payload && typeof payload.phase === 'string'
          ? payload.phase
          : event.type,
    detail:
      payload && typeof payload.message === 'string'
        ? payload.message
        : payload && typeof payload.text === 'string'
          ? payload.text
          : undefined,
    rawEvent: event,
  });
};

const compactSessionEvent = (
  event: SessionEvent | undefined,
): SessionEvent[] => (event ? [event] : []);

export const mapCoreSessionEvent = (
  event: ClineSdkCoreSessionEventResource,
): SessionEvent | undefined => {
  const events = mapCoreSessionEvents(event);
  return (
    events.find(
      (sessionEvent) =>
        sessionEvent.type === 'session-update' &&
        isToolCallSessionUpdate(sessionEvent.update),
    ) ?? events[0]
  );
};

export const mapCoreSessionEvents = (
  event: ClineSdkCoreSessionEventResource,
): SessionEvent[] => {
  switch (event.type) {
    case 'chunk':
      return mapChunkEvents(event);
    case 'agent_event':
      return compactSessionEvent(
        mapAgentRuntimeEvent(
          event.payload.event as ClineSdkAgentRuntimeEventResource,
        ),
      );
    case 'ended':
      return [
        {
          type: 'session-ended',
          stopReason: mapFinishReasonToStopReason(
            event.payload.reason ?? event.payload.finishReason,
          ),
        },
      ];
    case 'status':
    case 'hook':
    case 'pending_prompts':
    case 'pending_prompt_submitted':
    case 'session_snapshot':
    case 'team_progress':
      return [mapCoreProgressEvent(event)];
    default:
      return [];
  }
};
