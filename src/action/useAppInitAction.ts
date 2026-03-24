import type { JsonValue } from '../../core/chat';
import { useEffect } from 'react';
import type { SessionEvent } from '../model/chat';
import { assistantMessageEventService } from '../service/assistantMessageEventService';
import { useChatStore } from '../store/chatStore';
import { chatService } from '../service/chatService';
import { errorEventService } from '../service/errorEventService';
import { humanDecisionEventService } from '../service/humanDecisionEventService';
import { permissionEventService } from '../service/permissionEventService';
import { planEventService } from '../service/planEventService';
import { taskStateEventService } from '../service/taskStateEventService';
import { toolCallLogService } from '../service/toolEvent/toolCallLogService';
import { toolEventService } from '../service/toolEvent/toolEventService';
import type { UiToolCallContent, UiToolCallLocation } from '../model/chat';

type TaskEvent = Parameters<Parameters<typeof chatService.subscribeEvents>[0]>[0];
type SessionUpdateEvent = Extract<TaskEvent, { type: 'sessionUpdate' }>;
type ToolCallEvent = Extract<SessionEvent, { type: 'toolCall' }>;
type ToolCallSessionUpdate = Extract<SessionUpdateEvent['update'], { sessionUpdate: 'tool_call' | 'tool_call_update' }>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const toJsonValue = (value: unknown): JsonValue | undefined => toolCallLogService.toJsonValue(value);

const toToolCallContent = (value: unknown): UiToolCallContent | undefined => {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return undefined;
  }

  switch (value.type) {
    case 'content':
      return 'content' in value ? { type: 'content', content: value.content } : undefined;
    case 'diff':
      return typeof value.path === 'string' && typeof value.newText === 'string'
        ? {
            type: 'diff',
            path: value.path,
            newText: value.newText,
            oldText: typeof value.oldText === 'string' || value.oldText === null ? value.oldText : undefined,
          }
        : undefined;
    case 'terminal':
      return typeof value.terminalId === 'string' ? { type: 'terminal', terminalId: value.terminalId } : undefined;
    default:
      return undefined;
  }
};

const getToolCallContent = (update: SessionUpdateEvent['update']): UiToolCallContent[] | undefined => {
  if (!('content' in update) || !Array.isArray(update.content)) {
    return undefined;
  }

  const content = update.content
    .map((item) => toToolCallContent(item))
    .filter((item): item is UiToolCallContent => Boolean(item));

  return content.length > 0 ? content : undefined;
};

const getToolCallLocations = (update: SessionUpdateEvent['update']): UiToolCallLocation[] | undefined => {
  if (!('locations' in update) || !Array.isArray(update.locations)) {
    return undefined;
  }

  const locations = update.locations.filter(isRecord).map((location) => ({ ...location }));
  return locations.length > 0 ? locations as UiToolCallLocation[] : undefined;
};

const getToolCallDetails = (update: SessionUpdateEvent['update']): string | undefined => {
  const textContent = getToolCallContent(update)
    ?.map((item) => {
      if (item.type === 'content' && isRecord(item.content) && item.content.type === 'text' && typeof item.content.text === 'string') {
        return item.content.text;
      }

      if (item.type === 'diff') {
        return `Diff: ${item.path}`;
      }

      if (item.type === 'terminal') {
        return `Terminal: ${item.terminalId}`;
      }

      return null;
    })
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join('\n');

  return textContent || undefined;
};

const getStatusLabel = (status?: string) => {
  switch (status) {
    case 'processing':
    case 'in_progress':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'error':
    case 'failed':
      return 'Error';
    default:
      return 'Running tool';
  }
};

const isToolCallSessionUpdate = (update: SessionUpdateEvent['update']): update is ToolCallSessionUpdate => {
  return update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update';
};

const resolveToolKind = (event: SessionUpdateEvent): ToolCallEvent['toolKind'] => (
  isToolCallSessionUpdate(event.update)
    ? toolEventService.normalizeToolKind(event.update.kind)
    : 'other'
);

const toBaseToolCallEvent = (event: SessionUpdateEvent): Omit<ToolCallEvent, 'toolKind'> => ({
  type: 'toolCall',
  role: 'assistant',
  delivery: 'confirmed',
  taskId: event.taskId,
  sessionId: event.sessionId,
  timestamp: event.timestamp,
  toolCallId: isToolCallSessionUpdate(event.update) ? event.update.toolCallId : undefined,
  title: ('title' in event.update && typeof event.update.title === 'string' ? event.update.title : undefined) ?? 'Tool call',
  statusLabel: getStatusLabel('status' in event.update && typeof event.update.status === 'string' ? event.update.status : undefined),
  rawInput: 'rawInput' in event.update ? toJsonValue(event.update.rawInput) : undefined,
  rawOutput: 'rawOutput' in event.update ? toJsonValue(event.update.rawOutput) : undefined,
  toolLog: toolCallLogService.createToolCallLog({
    toolCallId: isToolCallSessionUpdate(event.update) ? event.update.toolCallId : undefined,
    toolKind: resolveToolKind(event),
    title: ('title' in event.update && typeof event.update.title === 'string' ? event.update.title : undefined) ?? 'Tool call',
    status: 'status' in event.update && typeof event.update.status === 'string' ? event.update.status : undefined,
    statusLabel: getStatusLabel('status' in event.update && typeof event.update.status === 'string' ? event.update.status : undefined),
    rawInput: 'rawInput' in event.update ? toJsonValue(event.update.rawInput) : undefined,
    rawOutput: 'rawOutput' in event.update ? toJsonValue(event.update.rawOutput) : undefined,
    content: getToolCallContent(event.update),
    locations: getToolCallLocations(event.update),
  }),
  content: getToolCallContent(event.update),
  locations: getToolCallLocations(event.update),
  details: getToolCallDetails(event.update),
});

const toToolCallEvent = (event: SessionUpdateEvent): SessionEvent | undefined => {
  if (!isToolCallSessionUpdate(event.update)) {
    return undefined;
  }

  const baseEvent = toBaseToolCallEvent(event);
  return toolEventService.toToolEvent(baseEvent, resolveToolKind(event));
};

const toSessionEvent = (event: TaskEvent): SessionEvent | undefined => {
  if (event.type === 'sessionUpdate') {
    return assistantMessageEventService.toAssistantMessageChunkEvent(event)
      ?? planEventService.toPlanEvent(event)
      ?? toToolCallEvent(event);
  }

  return permissionEventService.toPermissionRequestEvent(event)
    ?? humanDecisionEventService.toHumanDecisionRequestEvent(event)
    ?? assistantMessageEventService.toAssistantMessageCompletedEvent(event)
    ?? taskStateEventService.toTaskStateChangedEvent(event)
    ?? errorEventService.toErrorEvent(event);
};

export const useAppInitAction = () => {
  const { upsertTask, updateTaskState, applyUiEvent, bootError, setBootError } = useChatStore();

  useEffect(() => {
    let active = true;

    if (!window.nami?.chat) {
      setBootError('Electron preload bridge is unavailable. Check preload loading in the main process.');
      return;
    }

    const unsubscribe = chatService.subscribeEvents((event) => {
      if (event.type === 'taskStarted') {
        upsertTask(chatService.toUiTask(event.task));
      }

      if (event.type === 'taskStateChanged') {
        updateTaskState({ taskId: event.taskId, state: event.state, updatedAt: event.timestamp });
      }

      if ('taskId' in event && typeof event.taskId === 'string') {
        const uiEvent = toSessionEvent(event);
        if (uiEvent) {
          applyUiEvent(event.taskId, uiEvent);
        }
      }
    });

    if (useChatStore.getState().cwd) {
      setBootError(null);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, [applyUiEvent, setBootError, updateTaskState, upsertTask]);

  return { bootError };
};
