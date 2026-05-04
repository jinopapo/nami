type ToolCallSessionUpdate = {
  sessionUpdate: 'tool_call' | 'tool_call_update';
  toolCallId?: string;
  kind?: string | null;
  title?: string | null;
  status?: string | null;
  rawInput?: unknown;
  rawOutput?: unknown;
};

type ToolCallLogJsonPrimitive = string | number | boolean | null;
type ToolCallLogJsonValue =
  | ToolCallLogJsonPrimitive
  | ToolCallLogJsonObject
  | ToolCallLogJsonArray;
type ToolCallLogJsonObject = {
  [key: string]: ToolCallLogJsonValue | undefined;
};
type ToolCallLogJsonArray = ToolCallLogJsonValue[];
type PersistedToolKind =
  | 'read'
  | 'edit'
  | 'delete'
  | 'move'
  | 'search'
  | 'execute'
  | 'think'
  | 'fetch'
  | 'switch_mode'
  | 'other';
type PersistedToolCallLogPhase = 'start' | 'update' | 'complete' | 'error';
type PersistedToolCallLog = {
  toolCallId?: string;
  toolKind: PersistedToolKind;
  title: string;
  phase: PersistedToolCallLogPhase;
  status?: string;
  statusLabel: string;
  rawInput?: ToolCallLogJsonValue;
  rawOutput?: ToolCallLogJsonValue;
  inputSummary?: ToolCallLogJsonObject;
  outputSummary?: ToolCallLogJsonObject;
  metadata?: ToolCallLogJsonObject;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toJsonValue = (value: unknown): ToolCallLogJsonValue | undefined => {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : String(value);
  if (Array.isArray(value)) {
    const items = value
      .map((item) => toJsonValue(item))
      .filter((item): item is ToolCallLogJsonValue => item !== undefined);
    return items;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, toJsonValue(item)] as const)
      .filter(([, item]) => item !== undefined);
    return Object.fromEntries(entries);
  }
  return value === undefined ? undefined : String(value);
};

const getRecord = (
  value: ToolCallLogJsonValue | undefined,
): ToolCallLogJsonObject | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as ToolCallLogJsonObject)
    : undefined;

const getString = (
  record: ToolCallLogJsonObject | undefined,
  ...keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
};

const getNumber = (
  record: ToolCallLogJsonObject | undefined,
  ...keys: string[]
): number | undefined => {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'number') return value;
  }
  return undefined;
};

const getArrayLength = (
  record: ToolCallLogJsonObject | undefined,
  ...keys: string[]
): number | undefined => {
  for (const key of keys) {
    const value = record?.[key];
    if (Array.isArray(value)) return value.length;
  }
  return undefined;
};

const compactObject = (
  value: Record<string, ToolCallLogJsonValue | undefined>,
): ToolCallLogJsonObject | undefined => {
  const entries = Object.entries(value).filter(
    ([, item]) => item !== undefined,
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const resolveToolKind = (update: ToolCallSessionUpdate): PersistedToolKind => {
  switch (update.kind) {
    case 'read':
    case 'edit':
    case 'delete':
    case 'move':
    case 'search':
    case 'execute':
    case 'think':
    case 'fetch':
    case 'switch_mode':
      return update.kind;
    default:
      return 'other';
  }
};

const resolvePhase = (status?: string): PersistedToolCallLog['phase'] => {
  switch (status) {
    case 'completed':
      return 'complete';
    case 'error':
    case 'failed':
    case 'cancelled':
      return 'error';
    case 'processing':
    case 'in_progress':
      return 'update';
    default:
      return status ? 'update' : 'start';
  }
};

const getStatusLabel = (status?: string): string => {
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

export const createToolCallLog = (
  update: ToolCallSessionUpdate,
): PersistedToolCallLog => {
  const rawInput = toJsonValue(update.rawInput);
  const rawOutput = toJsonValue(update.rawOutput);
  const inputRecord = getRecord(rawInput);
  const outputRecord = getRecord(rawOutput);
  const toolKind = resolveToolKind(update);

  return {
    toolCallId: update.toolCallId,
    toolKind,
    title: typeof update.title === 'string' ? update.title : 'Tool call',
    phase: resolvePhase(
      typeof update.status === 'string' ? update.status : undefined,
    ),
    status: typeof update.status === 'string' ? update.status : undefined,
    statusLabel: getStatusLabel(
      typeof update.status === 'string' ? update.status : undefined,
    ),
    rawInput,
    rawOutput,
    inputSummary: compactObject({
      path: getString(inputRecord, 'path', 'filePath'),
      targetPath: getString(inputRecord, 'targetPath', 'destinationPath', 'to'),
      cwd: getString(inputRecord, 'cwd'),
      command: getString(inputRecord, 'command'),
      url: getString(inputRecord, 'url'),
      query: getString(inputRecord, 'query', 'pattern'),
      line: getNumber(inputRecord, 'line'),
      limit: getNumber(inputRecord, 'limit'),
      diffCount: getArrayLength(inputRecord, 'changes', 'diffs'),
    }),
    outputSummary: compactObject({
      path: getString(outputRecord, 'path'),
      stdoutLength: getString(outputRecord, 'stdout')?.length,
      stderrLength: getString(outputRecord, 'stderr')?.length,
      exitCode: getNumber(outputRecord, 'exitCode'),
      resultCount: getArrayLength(outputRecord, 'items', 'results', 'matches'),
    }),
    metadata: compactObject({
      sessionUpdate: update.sessionUpdate,
      hasRawInput: rawInput !== undefined,
      hasRawOutput: rawOutput !== undefined,
    }),
  };
};
