import type { SessionEvent } from '../../model/chat';

type ToolCallEvent = Extract<SessionEvent, { type: 'toolCall' }>;
type BaseToolCallEvent = Omit<ToolCallEvent, 'toolKind'>;
type ToolKind = ToolCallEvent['toolKind'];

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

const normalizeToolKind = (toolKind: string | null | undefined): ToolKind => (
  toolKind && SUPPORTED_TOOL_KINDS.has(toolKind as ToolKind)
    ? (toolKind as ToolKind)
    : 'other'
);

const toToolEvent = (input: BaseToolCallEvent, toolKind: ToolKind): ToolCallEvent => ({
  ...input,
  toolKind,
});

export const toolEventService = {
  normalizeToolKind,
  toToolEvent,
};