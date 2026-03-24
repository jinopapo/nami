import type { JsonObject, JsonValue, ToolCallLog, ToolKind } from '../../../core/chat';
import type { UiToolCallContent, UiToolCallLocation } from '../../model/chat';

type ToolCallPhase = ToolCallLog['phase'];

type BuildToolCallLogInput = {
  toolCallId?: string;
  toolKind: ToolKind;
  title: string;
  statusLabel: string;
  status?: string;
  rawInput?: JsonValue;
  rawOutput?: JsonValue;
  content?: UiToolCallContent[];
  locations?: UiToolCallLocation[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const toJsonValue = (value: unknown): JsonValue | undefined => {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (Array.isArray(value)) {
    const items = value
      .map((item) => toJsonValue(item))
      .filter((item): item is JsonValue => item !== undefined);
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

const getRecord = (value: JsonValue | undefined): JsonObject | undefined => (value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : undefined);

const getString = (record: JsonObject | undefined, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
};

const getNumber = (record: JsonObject | undefined, ...keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'number') return value;
  }
  return undefined;
};

const getArrayLength = (record: JsonObject | undefined, ...keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record?.[key];
    if (Array.isArray(value)) return value.length;
  }
  return undefined;
};

const compactObject = (value: Record<string, JsonValue | undefined>): JsonObject | undefined => {
  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const resolvePhase = (status?: string): ToolCallPhase => {
  switch (status) {
    case 'completed':
      return 'complete';
    case 'error':
    case 'failed':
    case 'cancelled':
      return 'error';
    case 'processing':
    case 'in_progress':
    default:
      return status ? 'update' : 'start';
  }
};

const buildInputSummary = (toolKind: ToolKind, rawInput?: JsonValue, content?: UiToolCallContent[], locations?: UiToolCallLocation[]): JsonObject | undefined => {
  const record = getRecord(rawInput);
  const common = compactObject({
    path: getString(record, 'path', 'filePath'),
    targetPath: getString(record, 'targetPath', 'destinationPath', 'to'),
    cwd: getString(record, 'cwd'),
    url: getString(record, 'url'),
    command: getString(record, 'command'),
    query: getString(record, 'query', 'pattern'),
    line: getNumber(record, 'line'),
    limit: getNumber(record, 'limit'),
    contentItems: content?.length,
    locationItems: locations?.length,
  });

  switch (toolKind) {
    case 'read':
      return compactObject({ ...common, offset: getNumber(record, 'offset'), length: getNumber(record, 'length') });
    case 'edit':
      return compactObject({
        ...common,
        oldTextLength: getString(record, 'oldText')?.length,
        newTextLength: getString(record, 'newText')?.length,
        diffCount: getArrayLength(record, 'changes', 'diffs'),
      });
    case 'search':
      return compactObject({ ...common, filePattern: getString(record, 'filePattern', 'glob') });
    case 'execute':
      return compactObject({ ...common, requiresApproval: record?.requiresApproval });
    case 'fetch':
      return compactObject({ ...common, method: getString(record, 'method') });
    default:
      return common;
  }
};

const buildOutputSummary = (rawOutput?: JsonValue): JsonObject | undefined => {
  const record = getRecord(rawOutput);
  return compactObject({
    path: getString(record, 'path'),
    stdoutLength: getString(record, 'stdout')?.length,
    stderrLength: getString(record, 'stderr')?.length,
    exitCode: getNumber(record, 'exitCode'),
    contentLength: getString(record, 'content', 'text')?.length,
    itemCount: getArrayLength(record, 'items', 'results', 'matches'),
  });
};

const buildMetadata = (input: BuildToolCallLogInput): JsonObject | undefined => compactObject({
  hasRawInput: input.rawInput !== undefined,
  hasRawOutput: input.rawOutput !== undefined,
  contentItems: input.content?.length,
  locationItems: input.locations?.length,
});

const createToolCallLog = (input: BuildToolCallLogInput): ToolCallLog => ({
  toolCallId: input.toolCallId,
  toolKind: input.toolKind,
  title: input.title,
  phase: resolvePhase(input.status),
  status: input.status,
  statusLabel: input.statusLabel,
  rawInput: input.rawInput,
  rawOutput: input.rawOutput,
  inputSummary: buildInputSummary(input.toolKind, input.rawInput, input.content, input.locations),
  outputSummary: buildOutputSummary(input.rawOutput),
  metadata: buildMetadata(input),
});

export const toolCallLogService = {
  createToolCallLog,
  toJsonValue,
};