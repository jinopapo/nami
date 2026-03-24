import type { DefaultToolCallDisplay, SessionEvent, ToolCallDisplay } from '../../model/chat';

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
  const path = event.rawInput && typeof event.rawInput === 'object' && !Array.isArray(event.rawInput) && typeof event.rawInput.path === 'string'
    ? event.rawInput.path
    : undefined;

  switch (getRawInputToolName(event.rawInput)) {
    case 'readFile':
      return { variant: 'read', path, message: path ? `${path} 読み込み中` : 'ファイル読み込み中' };
    default:
      return createDefaultDisplay();
  }
};

export const toolCallDisplayRepository = {
  create,
};