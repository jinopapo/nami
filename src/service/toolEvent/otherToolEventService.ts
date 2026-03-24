import type { SessionEvent } from '../../model/chat';

const toOtherToolEvent = (input: Omit<Extract<SessionEvent, { type: 'toolCall' }>, 'toolKind'>): SessionEvent => ({ ...input, toolKind: 'other' });

export const otherToolEventService = { toOtherToolEvent };