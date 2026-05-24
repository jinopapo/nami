import type { SessionEvent } from '../model/chat';

type SessionUpdateEvent = {
  type: 'sessionUpdate';
  taskId: string;
  sessionId: string;
  timestamp: string;
  update: Record<string, unknown> & { sessionUpdate: string };
};

type UiJsonPrimitive = string | number | boolean | null;
type UiJsonValue = UiJsonPrimitive | UiJsonObject | UiJsonValue[];
type UiJsonObject = { [key: string]: UiJsonValue | undefined };

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

const toProgressEvent = (
  event: SessionUpdateEvent,
): SessionEvent | undefined => {
  if (event.update.sessionUpdate !== 'progress') {
    return undefined;
  }

  return {
    type: 'progress',
    role: 'assistant',
    delivery: 'confirmed',
    taskId: event.taskId,
    sessionId: event.sessionId,
    timestamp: event.timestamp,
    progressId:
      typeof event.update.progressId === 'string'
        ? event.update.progressId
        : undefined,
    title:
      typeof event.update.title === 'string'
        ? event.update.title
        : '進捗を更新中',
    status:
      typeof event.update.status === 'string' ? event.update.status : undefined,
    detail:
      typeof event.update.detail === 'string' ? event.update.detail : undefined,
    rawEvent: toJsonValue(event.update.rawEvent),
  };
};

// eslint-disable-next-line no-grouped-exports/no-exported-function-object -- Existing service object pattern.
export const progressEventService = { toProgressEvent };