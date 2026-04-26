import { chatRepository } from '../repository/chatRepository';
import type { SessionEvent, UiPlanEntry } from '../model/chat';

type TaskEvent = Parameters<
  Parameters<typeof chatRepository.subscribeEvents>[0]
>[0];
type SessionUpdateEvent = Extract<TaskEvent, { type: 'sessionUpdate' }>;

const toUiPlanEntries = (entries: unknown[]): UiPlanEntry[] =>
  entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const item = entry as { content?: unknown; status?: unknown };
    return [
      {
        content: typeof item.content === 'string' ? item.content : '',
        status: typeof item.status === 'string' ? item.status : undefined,
      },
    ];
  });

const toPlanEvent = (event: SessionUpdateEvent): SessionEvent | undefined => {
  if (
    event.update.sessionUpdate !== 'plan' ||
    !Array.isArray(event.update.entries)
  ) {
    return undefined;
  }

  return {
    type: 'plan',
    role: 'assistant',
    delivery: 'confirmed',
    taskId: event.taskId,
    sessionId: event.sessionId,
    timestamp: event.timestamp,
    entries: toUiPlanEntries(event.update.entries),
  };
};

// eslint-disable-next-line no-grouped-exports/no-exported-function-object -- Existing service object; clean up separately.
export const planEventService = {
  toPlanEvent,
};
