import { chatRepository } from '../repository/chatRepository';
import type { SessionEvent } from '../model/chat';

type TaskEvent = Parameters<Parameters<typeof chatRepository.subscribeEvents>[0]>[0];

const toHumanDecisionRequestEvent = (event: TaskEvent): SessionEvent | undefined => {
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

export const humanDecisionEventService = {
  toHumanDecisionRequestEvent,
};