import { chatRepository } from '../repository/chatRepository';
import type { SessionEvent } from '../model/chat';

type TaskEvent = Parameters<Parameters<typeof chatRepository.subscribeEvents>[0]>[0];

const toTaskStateChangedEvent = (event: TaskEvent): SessionEvent | undefined => {
  if (event.type !== 'taskStateChanged') {
    return undefined;
  }

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
};

export const taskStateEventService = {
  toTaskStateChangedEvent,
};