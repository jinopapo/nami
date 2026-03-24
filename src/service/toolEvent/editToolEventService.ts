import type { SessionEvent } from '../../model/chat';

const toEditToolEvent = (input: Omit<Extract<SessionEvent, { type: 'toolCall' }>, 'toolKind'>): SessionEvent => ({ ...input, toolKind: 'edit' });

export const editToolEventService = { toEditToolEvent };