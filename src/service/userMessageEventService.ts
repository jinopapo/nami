import { chatRepository } from '../repository/chatRepository';
import type { SessionEvent } from '../model/chat';

type TaskEvent = Parameters<
  Parameters<typeof chatRepository.subscribeEvents>[0]
>[0];
type SessionUpdateEvent = Extract<TaskEvent, { type: 'sessionUpdate' }>;

const getMessageText = (
  update: SessionUpdateEvent['update'],
): string | undefined => {
  if ('text' in update && typeof update.text === 'string') {
    return update.text;
  }

  if (
    'content' in update &&
    update.content &&
    typeof update.content === 'object' &&
    'type' in update.content &&
    update.content.type === 'text' &&
    'text' in update.content &&
    typeof update.content.text === 'string'
  ) {
    return update.content.text;
  }

  return undefined;
};

const toUserMessageEvent = (
  event: SessionUpdateEvent,
): SessionEvent | undefined => {
  if (event.update.sessionUpdate !== 'user_message_chunk') {
    return undefined;
  }

  const text = getMessageText(event.update);
  if (!text) {
    return undefined;
  }

  return {
    type: 'userMessage',
    role: 'user',
    delivery: 'confirmed',
    taskId: event.taskId,
    sessionId: event.sessionId,
    timestamp: event.timestamp,
    text,
  };
};

export const userMessageEventService = {
  toUserMessageEvent,
};