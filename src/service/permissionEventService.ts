import { chatRepository } from '../repository/chatRepository';
import type { SessionEvent } from '../model/chat';

type TaskEvent = Parameters<
  Parameters<typeof chatRepository.subscribeEvents>[0]
>[0];

const toPermissionRequestEvent = (
  event: TaskEvent,
): SessionEvent | undefined => {
  if (event.type !== 'permissionRequest') {
    return undefined;
  }

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
};

// eslint-disable-next-line no-grouped-exports/no-exported-function-object -- Existing service object; clean up separately.
export const permissionEventService = {
  toPermissionRequestEvent,
};
