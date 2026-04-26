import { chatRepository } from '../repository/chatRepository';
import type { SessionEvent } from '../model/chat';

type TaskEvent = Parameters<
  Parameters<typeof chatRepository.subscribeEvents>[0]
>[0];

const toHumanDecisionRequestEvent = (
  event: TaskEvent,
): SessionEvent | undefined => {
  if (event.type !== 'humanDecisionRequest') {
    return undefined;
  }

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
};

// eslint-disable-next-line no-grouped-exports/no-exported-function-object -- Existing service object; clean up separately.
export const humanDecisionEventService = {
  toHumanDecisionRequestEvent,
};
