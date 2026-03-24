import type { SessionEvent } from '../../model/chat';

const toExecuteToolEvent = (input: Omit<Extract<SessionEvent, { type: 'toolCall' }>, 'toolKind'>): SessionEvent => ({ ...input, toolKind: 'execute' });

export const executeToolEventService = { toExecuteToolEvent };