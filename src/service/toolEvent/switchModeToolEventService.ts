import type { SessionEvent } from '../../model/chat';

const toSwitchModeToolEvent = (input: Omit<Extract<SessionEvent, { type: 'toolCall' }>, 'toolKind'>): SessionEvent => ({ ...input, toolKind: 'switch_mode' });

export const switchModeToolEventService = { toSwitchModeToolEvent };