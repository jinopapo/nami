import type { SessionEvent } from '../../model/chat';

const toThinkToolEvent = (input: Omit<Extract<SessionEvent, { type: 'toolCall' }>, 'toolKind'>): SessionEvent => ({ ...input, toolKind: 'think' });

export const thinkToolEventService = { toThinkToolEvent };