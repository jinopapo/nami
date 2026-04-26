import { chatRepository } from '../repository/chatRepository';
import type { SessionEvent } from '../model/chat';

type TaskEvent = Parameters<
  Parameters<typeof chatRepository.subscribeEvents>[0]
>[0];

const toErrorEvent = (event: TaskEvent): SessionEvent | undefined => {
  if (event.type !== 'error') {
    return undefined;
  }

  return {
    type: 'error',
    role: 'assistant',
    delivery: 'confirmed',
    taskId: event.taskId,
    sessionId: event.sessionId,
    timestamp: event.timestamp,
    message: event.message,
  };
};

// eslint-disable-next-line no-grouped-exports/no-exported-function-object -- Existing service object; clean up separately.
export const errorEventService = {
  toErrorEvent,
};
