import type {
  DefaultToolCallDisplay,
  SessionEvent,
  ToolCallDisplay,
} from '../../model/chat';

type ToolCallEvent = Extract<SessionEvent, { type: 'toolCall' }>;

const getRawInputToolName = (
  rawInput: ToolCallEvent['rawInput'],
): string | undefined => {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    return undefined;
  }

  return typeof rawInput.tool === 'string' ? rawInput.tool : undefined;
};

const getRawInputString = (
  rawInput: ToolCallEvent['rawInput'],
  key: string,
): string | undefined => {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    return undefined;
  }

  return typeof rawInput[key] === 'string' ? rawInput[key] : undefined;
};

const createDefaultDisplay = (): DefaultToolCallDisplay => ({
  variant: 'default',
  showDetails: true,
});

const create = (event: ToolCallEvent): ToolCallDisplay => {
  const path = getRawInputString(event.rawInput, 'path');
  const regex = getRawInputString(event.rawInput, 'regex');
  const toolName = getRawInputToolName(event.rawInput);

  switch (toolName) {
    case 'readFile':
    case 'listFilesRecursive':
      return {
        variant: 'read',
        path,
        message: path ? `${path} 読み込み中` : 'ファイル読み込み中',
      };
    case 'listCodeDefinitionNames':
      return {
        variant: 'read',
        path,
        message: path ? `${path} を分析中` : 'コード定義を分析中',
      };
    case 'searchFiles':
      return {
        variant: 'read',
        path,
        message:
          path && regex
            ? `${path}内を${regex}で検索中`
            : regex
              ? `${regex}で検索中`
              : path
                ? `${path}内を検索中`
                : '検索中',
      };
    case 'editedExistingFile':
      return {
        variant: 'read',
        path,
        message: 'ファイルを変更中',
      };
    default:
      return createDefaultDisplay();
  }
};

export const toolCallDisplayRepository = {
  create,
};
