import type {
  DefaultToolCallDisplay,
  SessionEvent,
  ToolCallDisplay,
} from '../../model/chat';

type ToolCallEvent = Extract<SessionEvent, { type: 'toolCall' }>;

const getPayloadString = (
  payload: ToolCallEvent['rawInput'] | ToolCallEvent['rawOutput'],
  key: string,
): string | undefined => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  return typeof payload[key] === 'string' ? payload[key] : undefined;
};

const getToolPayloadString = (
  event: ToolCallEvent,
  key: string,
): string | undefined =>
  getPayloadString(event.rawInput, key) ??
  getPayloadString(event.rawOutput, key);

const getToolName = (event: ToolCallEvent): string | undefined => {
  return getToolPayloadString(event, 'tool');
};

const createDefaultDisplay = (): DefaultToolCallDisplay => ({
  variant: 'default',
  showDetails: true,
});

const create = (event: ToolCallEvent): ToolCallDisplay => {
  const path = getToolPayloadString(event, 'path');
  const regex = getToolPayloadString(event, 'regex');
  const readFilePath = getPayloadString(event.rawOutput, 'path');
  const toolName = getToolName(event);

  switch (toolName) {
    case 'readFile':
      return {
        variant: 'read',
        path: readFilePath,
        message: readFilePath
          ? `${readFilePath} 読み込み中`
          : 'ファイル読み込み中',
      };
    case 'listFilesRecursive':
    case 'listFilesTopLevel':
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
    case 'newFileCreated':
      return {
        variant: 'read',
        path,
        message: path ? `${path}を作成中` : 'ファイルを作成中',
      };
    case 'editedExistingFile':
      return {
        variant: 'read',
        path,
        message: path ? `${path}を変更中` : 'ファイルを変更中',
      };
    default:
      return createDefaultDisplay();
  }
};

export const toolCallDisplayRepository = {
  create,
};
