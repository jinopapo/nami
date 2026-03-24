import type { DefaultToolCallDisplay, SessionEvent, ToolCallDisplay } from '../../model/chat';
import { readToolCallDisplayService } from './readToolCallDisplayService';

type ToolCallEvent = Extract<SessionEvent, { type: 'toolCall' }>;

const createDefaultDisplay = (): DefaultToolCallDisplay => ({
  variant: 'default',
  showDetails: true,
});

const create = (event: ToolCallEvent): ToolCallDisplay => {
  switch (event.toolKind) {
    case 'read':
      return readToolCallDisplayService.create(event.rawInput);
    default:
      return createDefaultDisplay();
  }
};

export const toolCallDisplayService = {
  create,
};