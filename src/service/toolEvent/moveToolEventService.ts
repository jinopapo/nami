import type { SessionEvent } from '../../model/chat';

const toMoveToolEvent = (input: Omit<Extract<SessionEvent, { type: 'toolCall' }>, 'toolKind'>): SessionEvent => ({ ...input, toolKind: 'move' });

export const moveToolEventService = { toMoveToolEvent };