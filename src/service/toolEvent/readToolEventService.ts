import type { SessionEvent } from '../../model/chat';

const toReadToolEvent = (input: Omit<Extract<SessionEvent, { type: 'toolCall' }>, 'toolKind'>): SessionEvent => ({ ...input, toolKind: 'read' });

export const readToolEventService = { toReadToolEvent };