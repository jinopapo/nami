import type {
  AbortTaskInput,
  ResumeTaskInput,
  SendMessageInput,
  SendMessageResult,
  SelectDirectoryInput,
  SelectDirectoryResult,
  StartTaskInput,
  StartTaskResult,
  TaskEvent,
  TaskSummary,
} from '../../core/chat';
import type { SessionEvent, UiPlanEntry, UiTask } from '../model/chat';

const getChatApi = () => {
  if (!window.nami?.chat) {
    throw new Error('Electron preload bridge is unavailable.');
  }

  return window.nami.chat;
};

const getMessageText = (update: Extract<TaskEvent, { type: 'sessionUpdate' }>['update']): string | undefined => {
  if ('text' in update && typeof update.text === 'string') {
    return update.text;
  }

  if ('content' in update && update.content && typeof update.content === 'object' && 'type' in update.content && update.content.type === 'text' && 'text' in update.content && typeof update.content.text === 'string') {
    return update.content.text;
  }

  return undefined;
};

const getToolCallDetails = (update: Extract<TaskEvent, { type: 'sessionUpdate' }>['update']): string | undefined => {
  if (!('content' in update) || !Array.isArray(update.content)) {
    return undefined;
  }

  const textContent = update.content
    .map((item) => (item.type === 'content' && item.content.type === 'text' ? item.content.text : null))
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join('\n');

  return textContent || undefined;
};

const getStatusLabel = (status?: string) => {
  switch (status) {
    case 'processing':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'error':
      return 'Error';
    default:
      return 'Running tool';
  }
};

const toUiPlanEntries = (entries: unknown[]): UiPlanEntry[] => entries.flatMap((entry) => {
  if (!entry || typeof entry !== 'object') {
    return [];
  }

  const item = entry as { content?: unknown; status?: unknown };
  return [{ content: typeof item.content === 'string' ? item.content : '', status: typeof item.status === 'string' ? item.status : undefined }];
});

const toUiTask = (task: TaskSummary): UiTask => ({
  taskId: task.taskId,
  sessionId: task.sessionId,
  cwd: task.cwd,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  mode: task.mode,
  state: task.state,
});

const toUiEvent = (event: TaskEvent): SessionEvent | undefined => {
  if (event.type === 'permissionRequest') {
    return {
      type: 'permissionRequest',
      role: 'assistant',
      delivery: 'confirmed',
      taskId: event.taskId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      approvalId: event.approvalId,
      title: event.request.toolCall.title ?? 'Permission required',
    };
  }

  if (event.type === 'humanDecisionRequest') {
    return {
      type: 'humanDecisionRequest',
      role: 'assistant',
      delivery: 'confirmed',
      taskId: event.taskId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      requestId: event.requestId,
      title: event.title,
      description: event.description,
      schema: event.schema,
    };
  }

  if (event.type === 'assistantMessageCompleted') {
    return {
      type: 'assistantMessageCompleted',
      role: 'assistant',
      delivery: 'confirmed',
      taskId: event.taskId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      reason: event.reason,
    };
  }

  if (event.type === 'taskStateChanged') {
    return {
      type: 'taskStateChanged',
      role: 'assistant',
      delivery: 'confirmed',
      taskId: event.taskId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      state: event.state,
      reason: event.reason,
    };
  }

  if (event.type === 'error') {
    return {
      type: 'error',
      role: 'assistant',
      delivery: 'confirmed',
      taskId: event.taskId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      message: event.message,
    };
  }

  if (event.type !== 'sessionUpdate') {
    return undefined;
  }

  if (event.update.sessionUpdate === 'user_message_chunk' || event.update.sessionUpdate === 'agent_message_chunk') {
    if (event.update.sessionUpdate === 'user_message_chunk') {
      return undefined;
    }
    const text = getMessageText(event.update);
    if (!text) {
      return undefined;
    }

    return {
      type: 'assistantMessageChunk',
      role: 'assistant',
      delivery: 'confirmed',
      taskId: event.taskId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      text,
    };
  }

  if (event.update.sessionUpdate === 'plan' && Array.isArray(event.update.entries)) {
    return {
      type: 'plan',
      role: 'assistant',
      delivery: 'confirmed',
      taskId: event.taskId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      entries: toUiPlanEntries(event.update.entries),
    };
  }

  if (event.update.sessionUpdate === 'tool_call' || event.update.sessionUpdate === 'tool_call_update') {
    return {
      type: 'toolCall',
      role: 'assistant',
      delivery: 'confirmed',
      taskId: event.taskId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      toolCallId: event.update.toolCallId,
      title: event.update.title ?? 'Tool call',
      statusLabel: getStatusLabel(typeof event.update.status === 'string' ? event.update.status : undefined),
      details: getToolCallDetails(event.update),
    };
  }

  return undefined;
};

export const chatRepository = {
  startTask: (input: StartTaskInput): Promise<StartTaskResult> => getChatApi().startTask(input),
  sendMessage: (input: SendMessageInput): Promise<SendMessageResult> => getChatApi().sendMessage(input),
  abortTask: (input: AbortTaskInput): Promise<void> => getChatApi().abortTask(input),
  resumeTask: (input: ResumeTaskInput): Promise<void> => getChatApi().resumeTask(input),
  selectDirectory: (input?: SelectDirectoryInput): Promise<SelectDirectoryResult> => getChatApi().selectDirectory(input),
  subscribeEvents: (listener: (event: TaskEvent) => void): (() => void) => getChatApi().subscribeEvents(listener),
  toUiTask,
  toUiEvent,
};
