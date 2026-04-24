import type {
  SessionEvent,
  ToolCallLog,
  ToolKind,
  UiJsonObject,
  UiJsonValue,
  UiToolCallContent,
  UiToolCallLocation,
} from '../model/chat';

type SessionUpdateEvent = {
  type: 'sessionUpdate';
  taskId: string;
  sessionId: string;
  timestamp: string;
  update: Record<string, unknown> & { sessionUpdate: string };
};

type ToolCallPhase = ToolCallLog['phase'];

const SUPPORTED_TOOL_KINDS = new Set<ToolKind>([
  'read',
  'edit',
  'delete',
  'move',
  'search',
  'execute',
  'think',
  'fetch',
  'switch_mode',
  'other',
]);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toJsonValue = (value: unknown): UiJsonValue | undefined => {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : String(value);
  if (Array.isArray(value))
    return value
      .map((item) => toJsonValue(item))
      .filter((item): item is UiJsonValue => item !== undefined);
  if (isRecord(value))
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, toJsonValue(item)] as const)
        .filter(([, item]) => item !== undefined),
    );
  return value === undefined ? undefined : String(value);
};

const getRecord = (value: UiJsonValue | undefined): UiJsonObject | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UiJsonObject)
    : undefined;
const getString = (
  record: UiJsonObject | undefined,
  ...keys: string[]
): string | undefined =>
  keys
    .map((key) => record?.[key])
    .find(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
const getNumber = (
  record: UiJsonObject | undefined,
  ...keys: string[]
): number | undefined =>
  keys
    .map((key) => record?.[key])
    .find((value): value is number => typeof value === 'number');
const getArrayLength = (
  record: UiJsonObject | undefined,
  ...keys: string[]
): number | undefined =>
  keys.map((key) => record?.[key]).find(Array.isArray)?.length;
const compactObject = (
  value: Record<string, UiJsonValue | undefined>,
): UiJsonObject | undefined => {
  const entries = Object.entries(value).filter(
    ([, item]) => item !== undefined,
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};
const normalizeToolKind = (toolKind: string | null | undefined): ToolKind =>
  toolKind && SUPPORTED_TOOL_KINDS.has(toolKind as ToolKind)
    ? (toolKind as ToolKind)
    : 'other';

const resolvePhase = (status?: string): ToolCallPhase => {
  switch (status) {
    case 'completed':
      return 'complete';
    case 'error':
    case 'failed':
    case 'cancelled':
      return 'error';
    default:
      return status ? 'update' : 'start';
  }
};

const getStatusLabel = (status?: string) => {
  switch (status) {
    case 'processing':
    case 'in_progress':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'error':
    case 'failed':
      return 'Error';
    default:
      return 'Running tool';
  }
};

const toToolCallContent = (value: unknown): UiToolCallContent | undefined => {
  if (!isRecord(value) || typeof value.type !== 'string') return undefined;
  switch (value.type) {
    case 'content':
      return 'content' in value
        ? { type: 'content', content: value.content }
        : undefined;
    case 'diff':
      return typeof value.path === 'string' && typeof value.newText === 'string'
        ? {
            type: 'diff',
            path: value.path,
            newText: value.newText,
            oldText:
              typeof value.oldText === 'string' || value.oldText === null
                ? value.oldText
                : undefined,
          }
        : undefined;
    case 'terminal':
      return typeof value.terminalId === 'string'
        ? { type: 'terminal', terminalId: value.terminalId }
        : undefined;
    default:
      return undefined;
  }
};

const getToolCallContent = (
  update: SessionUpdateEvent['update'],
): UiToolCallContent[] | undefined => {
  if (!Array.isArray(update.content)) return undefined;
  const content = update.content
    .map((item) => toToolCallContent(item))
    .filter((item): item is UiToolCallContent => Boolean(item));
  return content.length > 0 ? content : undefined;
};

const getToolCallLocations = (
  update: SessionUpdateEvent['update'],
): UiToolCallLocation[] | undefined => {
  if (!Array.isArray(update.locations)) return undefined;
  const locations = update.locations
    .filter(isRecord)
    .map((location) => ({ ...location }));
  return locations.length > 0 ? (locations as UiToolCallLocation[]) : undefined;
};

const getToolCallDetails = (
  update: SessionUpdateEvent['update'],
): string | undefined =>
  getToolCallContent(update)
    ?.map((item) => {
      if (
        item.type === 'content' &&
        isRecord(item.content) &&
        item.content.type === 'text' &&
        typeof item.content.text === 'string'
      )
        return item.content.text;
      if (item.type === 'diff') return `Diff: ${item.path}`;
      if (item.type === 'terminal') return `Terminal: ${item.terminalId}`;
      return null;
    })
    .filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    )
    .join('\n') || undefined;

const isToolCallSessionUpdate = (
  update: SessionUpdateEvent['update'],
): boolean =>
  update.sessionUpdate === 'tool_call' ||
  update.sessionUpdate === 'tool_call_update';

const createToolCallLog = (input: {
  toolCallId?: string;
  toolKind: ToolKind;
  title: string;
  statusLabel: string;
  status?: string;
  rawInput?: UiJsonValue;
  rawOutput?: UiJsonValue;
  content?: UiToolCallContent[];
  locations?: UiToolCallLocation[];
}): ToolCallLog => {
  const inputRecord = getRecord(input.rawInput);
  const outputRecord = getRecord(input.rawOutput);
  return {
    toolCallId: input.toolCallId,
    toolKind: input.toolKind,
    title: input.title,
    phase: resolvePhase(input.status),
    status: input.status,
    statusLabel: input.statusLabel,
    rawInput: input.rawInput,
    rawOutput: input.rawOutput,
    inputSummary: compactObject({
      path: getString(inputRecord, 'path', 'filePath'),
      targetPath: getString(inputRecord, 'targetPath', 'destinationPath', 'to'),
      cwd: getString(inputRecord, 'cwd'),
      url: getString(inputRecord, 'url'),
      command: getString(inputRecord, 'command'),
      query: getString(inputRecord, 'query', 'pattern'),
      line: getNumber(inputRecord, 'line'),
      limit: getNumber(inputRecord, 'limit'),
      contentItems: input.content?.length,
      locationItems: input.locations?.length,
      diffCount: getArrayLength(inputRecord, 'changes', 'diffs'),
    }),
    outputSummary: compactObject({
      path: getString(outputRecord, 'path'),
      stdoutLength: getString(outputRecord, 'stdout')?.length,
      stderrLength: getString(outputRecord, 'stderr')?.length,
      exitCode: getNumber(outputRecord, 'exitCode'),
      contentLength: getString(outputRecord, 'content', 'text')?.length,
      itemCount: getArrayLength(outputRecord, 'items', 'results', 'matches'),
    }),
    metadata: compactObject({
      hasRawInput: input.rawInput !== undefined,
      hasRawOutput: input.rawOutput !== undefined,
      contentItems: input.content?.length,
      locationItems: input.locations?.length,
    }),
  };
};

const toToolCallEvent = (
  event: SessionUpdateEvent,
): SessionEvent | undefined => {
  if (!isToolCallSessionUpdate(event.update)) return undefined;
  const toolKind = normalizeToolKind(
    typeof event.update.kind === 'string' ? event.update.kind : undefined,
  );
  const title =
    typeof event.update.title === 'string' ? event.update.title : 'Tool call';
  const status =
    typeof event.update.status === 'string' ? event.update.status : undefined;
  const statusLabel = getStatusLabel(status);
  const rawInput = toJsonValue(event.update.rawInput);
  const rawOutput = toJsonValue(event.update.rawOutput);
  const content = getToolCallContent(event.update);
  const locations = getToolCallLocations(event.update);
  return {
    type: 'toolCall',
    role: 'assistant',
    delivery: 'confirmed',
    taskId: event.taskId,
    sessionId: event.sessionId,
    timestamp: event.timestamp,
    toolCallId:
      typeof event.update.toolCallId === 'string'
        ? event.update.toolCallId
        : undefined,
    toolKind,
    title,
    statusLabel,
    rawInput,
    rawOutput,
    toolLog: createToolCallLog({
      toolCallId:
        typeof event.update.toolCallId === 'string'
          ? event.update.toolCallId
          : undefined,
      toolKind,
      title,
      status,
      statusLabel,
      rawInput,
      rawOutput,
      content,
      locations,
    }),
    content,
    locations,
    details: getToolCallDetails(event.update),
  };
};

export const toolCallEventService = { toToolCallEvent };
