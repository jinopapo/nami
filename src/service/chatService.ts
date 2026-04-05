import { chatRepository } from '../repository/chatRepository';
import type { DisplayItem, PendingUserAction, SessionEvent, SessionStatus, UiTask } from '../model/chat';
import { toolCallDisplayRepository } from '../repository/toolEvent/toolCallDisplayRepository';

const CHAT_STATUS_LABEL = {
  idle: '入力待ち',
  planning: '計画中',
  awaiting_confirmation: '確認待ち',
  executing: '実行中',
  auto_checking: '自動チェック中',
  awaiting_review: 'レビュー待ち',
  waiting_permission: 'ツール実行の許可待ち',
} as const;

const getWaitingState = (task?: UiTask) => {
  if (!task) {
    return undefined;
  }

  if (task.runtimeState === 'waiting_permission' || task.runtimeState === 'waiting_human_decision') {
    return task.runtimeState;
  }

  return undefined;
};

const hasReadableMessage = (event: SessionEvent): boolean => event.type === 'assistantMessageChunk' && event.text.length > 0;

const isPendingActionClearedAfter = (events: SessionEvent[], index: number): boolean => {
  const laterEvents = events.slice(index + 1);
  return laterEvents.some((event) => event.type === 'taskStateChanged' && ['running', 'completed', 'aborted', 'error'].includes(event.state));
};

const getPendingUserAction = (task: UiTask | undefined, events: SessionEvent[]): PendingUserAction | undefined => {
  if (task?.runtimeState === 'waiting_permission') {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (event.type === 'permissionRequest' && !isPendingActionClearedAfter(events, index)) {
        return { type: 'permission', approvalId: event.approvalId, title: event.title, timestamp: event.timestamp };
      }
    }
  }

  if (task?.runtimeState === 'waiting_human_decision') {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (event.type === 'humanDecisionRequest' && !isPendingActionClearedAfter(events, index)) {
        return { type: 'humanDecision', requestId: event.requestId, title: event.title, description: event.description, timestamp: event.timestamp };
      }
    }
  }

  return undefined;
};

const hasPendingPermission = (task: UiTask | undefined, events: SessionEvent[]): boolean => getPendingUserAction(task, events)?.type === 'permission';

const toDisplayItems = (events: SessionEvent[]): DisplayItem[] => events.reduce<DisplayItem[]>((items, event, index) => {
  if (event.type === 'userMessage') {
    items.push({ type: 'userMessage', id: `user-message-${index}`, role: 'user', timestamp: event.timestamp, text: event.text, status: event.delivery === 'optimistic' ? 'pending' : 'sent' });
    return items;
  }

  if (event.type === 'assistantMessageChunk') {
    const lastItem = items[items.length - 1];
    if (lastItem?.type === 'assistantMessage' && lastItem.status === 'streaming') {
      lastItem.text = `${lastItem.text}${event.text}`;
      lastItem.timestamp = event.timestamp;
    } else {
      items.push({ type: 'assistantMessage', id: `assistant-message-${index}`, role: 'assistant', timestamp: event.timestamp, text: event.text, status: 'streaming' });
    }
    return items;
  }

  if (event.type === 'assistantMessageCompleted') {
    const assistantIndex = [...items].map((item) => item.type === 'assistantMessage' && item.status === 'streaming').lastIndexOf(true);
    if (assistantIndex >= 0) {
      const item = items[assistantIndex];
      if (item.type === 'assistantMessage') {
        item.status = 'sent';
        item.timestamp = event.timestamp;
      }
    }
    return items;
  }

  if (event.type === 'permissionResponse' || event.type === 'abort') {
    return items;
  }

  if (event.type === 'permissionRequest') {
    items.push({ type: 'permissionRequest', id: `permission-${event.approvalId}-${index}`, timestamp: event.timestamp, approvalId: event.approvalId, title: event.title });
    return items;
  }

  if (event.type === 'humanDecisionRequest') {
    items.push({ type: 'humanDecisionRequest', id: `human-decision-${event.requestId}-${index}`, timestamp: event.timestamp, requestId: event.requestId, title: event.title, description: event.description });
    return items;
  }

  if (event.type === 'plan') {
    items.push({ type: 'plan', id: `plan-${index}`, timestamp: event.timestamp, entries: event.entries });
    return items;
  }

  if (event.type === 'toolCall') {
    const next: DisplayItem = {
      type: 'toolCall',
      id: `tool-call-${event.toolCallId ?? index}`,
      timestamp: event.timestamp,
      toolCallId: event.toolCallId,
      toolKind: event.toolKind,
      title: event.title,
      statusLabel: event.statusLabel,
      rawInput: event.rawInput,
      rawOutput: event.rawOutput,
      toolLog: event.toolLog,
      content: event.content,
      locations: event.locations,
      details: event.details,
      display: toolCallDisplayRepository.create(event),
    };
    const existingIndex = event.toolCallId ? items.findIndex((item) => item.type === 'toolCall' && item.toolCallId === event.toolCallId) : -1;
    if (existingIndex >= 0) items[existingIndex] = next; else items.push(next);
    return items;
  }

  if (event.type === 'taskStateChanged') {
    items.push({ type: 'taskStateChanged', id: `task-state-${index}`, timestamp: event.timestamp, state: event.state, reason: event.reason });
    return items;
  }

  if (event.type === 'error') {
    items.push({ type: 'error', id: `error-${index}`, timestamp: event.timestamp, message: event.message });
  }

  return items;
}, []);

const getSessionStatus = (task: UiTask | undefined, pendingUserAction: PendingUserAction | undefined, events: SessionEvent[]): SessionStatus => {
  if (pendingUserAction?.type === 'permission' || hasPendingPermission(task, events)) {
    return { phase: 'waiting_permission', label: CHAT_STATUS_LABEL.waiting_permission, tone: 'waiting' };
  }

  if (task) {
    if (task.lifecycleState === 'planning') {
      return {
        phase: 'planning',
        label: CHAT_STATUS_LABEL.planning,
        tone: task.runtimeState === 'running' ? 'running' : 'idle',
      };
    }

    if (task.lifecycleState === 'awaiting_confirmation') {
      return { phase: 'awaiting_confirmation', label: CHAT_STATUS_LABEL.awaiting_confirmation, tone: 'waiting' };
    }

    if (task.lifecycleState === 'executing') {
      return {
        phase: 'executing',
        label: CHAT_STATUS_LABEL.executing,
        tone: task.runtimeState === 'running' ? 'running' : 'idle',
      };
    }

    if (task.lifecycleState === 'auto_checking') {
      return {
        phase: 'auto_checking',
        label: CHAT_STATUS_LABEL.auto_checking,
        tone: 'running',
      };
    }

    if (task.lifecycleState === 'awaiting_review') {
      return { phase: 'awaiting_review', label: CHAT_STATUS_LABEL.awaiting_review, tone: 'waiting' };
    }
  }

  return { phase: 'idle', label: CHAT_STATUS_LABEL.idle, tone: 'idle' };
};

export const chatService = {
  sendMessage: chatRepository.sendMessage,
  abortTask: chatRepository.abortTask,
  resumeTask: chatRepository.resumeTask,
  subscribeEvents: chatRepository.subscribeEvents,
  getWaitingState,
  getPendingUserAction,
  getSessionStatus,
  toDisplayItems,
  hasReadableMessage,
};