import type { DefaultToolCallDisplay, SessionEvent, ToolCallDisplay } from '../../model/chat';
import { readToolCallDisplayService } from './readToolCallDisplayService';

type ToolCallEvent = Extract<SessionEvent, { type: 'toolCall' }>;

const getRawInputToolName = (rawInput: ToolCallEvent['rawInput']): string | undefined => {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    return undefined;
  }

  return typeof rawInput.tool === 'string' ? rawInput.tool : undefined;
};

const createDefaultDisplay = (): DefaultToolCallDisplay => ({
  variant: 'default',
  showDetails: true,
});

const create = (event: ToolCallEvent): ToolCallDisplay => {
  switch (getRawInputToolName(event.rawInput)) {
    case 'readFile':
      return readToolCallDisplayService.create(event.rawInput);
    default:
      return createDefaultDisplay();
  }
};

export const toolCallDisplayService = {
  create,
};