import type { SessionEvent } from '../../model/chat';

const toFetchToolEvent = (input: Omit<Extract<SessionEvent, { type: 'toolCall' }>, 'toolKind'>): SessionEvent => ({ ...input, toolKind: 'fetch' });

export const fetchToolEventService = { toFetchToolEvent };