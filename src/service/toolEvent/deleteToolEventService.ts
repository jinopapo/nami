import type { SessionEvent } from '../../model/chat';

const toDeleteToolEvent = (input: Omit<Extract<SessionEvent, { type: 'toolCall' }>, 'toolKind'>): SessionEvent => ({ ...input, toolKind: 'delete' });

export const deleteToolEventService = { toDeleteToolEvent };