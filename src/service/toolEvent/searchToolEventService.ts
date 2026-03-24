import type { SessionEvent } from '../../model/chat';

const toSearchToolEvent = (input: Omit<Extract<SessionEvent, { type: 'toolCall' }>, 'toolKind'>): SessionEvent => ({ ...input, toolKind: 'search' });

export const searchToolEventService = { toSearchToolEvent };