import { randomUUID } from 'node:crypto';
import type { RequestPermissionRequest, SessionUpdate } from 'cline';
import type { ApprovalRequest, ChatEvent, ChatSessionSummary, DiffSummaryItem } from '../../core/chat.js';
import type { SessionRecord } from '../entity/chat.js';

const now = () => new Date().toISOString();

const extractMessageText = (update: SessionUpdate): string | undefined => {
  if ('text' in update && typeof update.text === 'string') {
    return update.text;
  }

  if (
    'content' in update
    && update.content
    && typeof update.content === 'object'
    && !Array.isArray(update.content)
    && 'type' in update.content
    && update.content.type === 'text'
    && 'text' in update.content
    && typeof update.content.text === 'string'
  ) {
    return update.content.text;
  }

  return undefined;
};

export const toSessionSummary = (session: SessionRecord): ChatSessionSummary => ({
  sessionId: session.sessionId,
  cwd: session.cwd,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
  mode: session.mode,
});

export const createSessionEvent = (session: SessionRecord): ChatEvent => ({
  id: randomUUID(),
  type: 'session',
  sessionId: session.sessionId,
  timestamp: now(),
  session: toSessionSummary(session),
});

export const createErrorEvent = (message: string, sessionId?: string): ChatEvent => ({
  id: randomUUID(),
  type: 'error',
  sessionId,
  timestamp: now(),
  message,
});

export const createMessageEvent = (
  sessionId: string,
  role: 'user' | 'assistant',
  text: string,
): ChatEvent => ({
  id: randomUUID(),
  type: 'message',
  sessionId,
  timestamp: now(),
  role,
  text,
});

export const createApprovalEvent = (
  sessionId: string,
  approvalId: string,
  request: RequestPermissionRequest,
  resolved = false,
  decision?: 'approve' | 'reject',
): ChatEvent => {
  const approval: ApprovalRequest = {
    approvalId,
    toolCallId: request.toolCall.toolCallId,
    title: request.toolCall.title ?? 'Permission required',
    kind: request.toolCall.kind ?? 'other',
    status: request.toolCall.status ?? undefined,
    options: request.options.map((option) => ({
      optionId: option.optionId,
      name: option.name,
      kind: option.kind,
    })),
    resolved,
    decision,
  };

  return {
    id: randomUUID(),
    type: 'approval',
    sessionId,
    timestamp: now(),
    approval,
  };
};

export const createApprovalResolvedEvent = (
  sessionId: string,
  approvalId: string,
  decision: 'approve' | 'reject',
): ChatEvent => ({
  id: randomUUID(),
  type: 'approval',
  sessionId,
  timestamp: now(),
  approval: {
    approvalId,
    toolCallId: approvalId,
    title: 'Permission resolved',
    kind: 'other',
    options: [],
    resolved: true,
    decision,
  },
});

export const createStatusEvent = (
  sessionId: string,
  status: 'idle' | 'processing' | 'completed' | 'cancelled' | 'error',
  detail?: string,
  stopReason?: string,
): ChatEvent => ({
  id: randomUUID(),
  type: 'status',
  sessionId,
  timestamp: now(),
  status,
  detail,
  stopReason,
});

export const createWorkspaceDiffEvent = (sessionId: string, snapshot: string[]): ChatEvent | null => {
  const items: DiffSummaryItem[] = snapshot
    .map((line) => line.split('\t'))
    .filter((parts) => parts.length >= 3)
    .map(([added, removed, filePath]) => {
      const addedLines = Number.parseInt(added, 10);
      const removedLines = Number.parseInt(removed, 10);

      return {
        path: filePath,
        addedLines: Number.isFinite(addedLines) ? addedLines : 0,
        removedLines: Number.isFinite(removedLines) ? removedLines : 0,
        summary: `${Number.isFinite(addedLines) ? addedLines : 0} additions, ${Number.isFinite(removedLines) ? removedLines : 0} deletions`,
      };
    });

  if (items.length === 0) {
    return null;
  }

  return {
    id: randomUUID(),
    type: 'diffSummary',
    sessionId,
    timestamp: now(),
    diff: {
      source: 'workspace',
      items,
    },
  };
};

export const normalizeSessionUpdate = (sessionId: string, update: SessionUpdate): ChatEvent[] => {
  if (update.sessionUpdate === 'agent_thought_chunk') {
    return [];
  }

  if (update.sessionUpdate === 'user_message_chunk' || update.sessionUpdate === 'agent_message_chunk') {
    const text = extractMessageText(update);

    if (!text) {
      return [];
    }

    return [createMessageEvent(
      sessionId,
      update.sessionUpdate === 'user_message_chunk' ? 'user' : 'assistant',
      text,
    )];
  }

  if (update.sessionUpdate === 'plan') {
    return [{
      id: randomUUID(),
      type: 'plan',
      sessionId,
      timestamp: now(),
      entries: update.entries.map((entry) => ({
        content: entry.content,
        priority: entry.priority,
        status: entry.status,
      })),
    }];
  }

  if (update.sessionUpdate === 'tool_call' || update.sessionUpdate === 'tool_call_update') {
    const textContent = update.content
      ?.map((item) => (item.type === 'content' && item.content.type === 'text' ? item.content.text : null))
      .filter(Boolean)
      .join('\n');
    const terminalId = update.content?.find((item) => item.type === 'terminal')?.terminalId;
    const diffItems = update.content
      ?.filter((item) => item.type === 'diff')
      .map((item) => ({
        path: item.path,
        addedLines: item.newText.split('\n').length,
        removedLines: item.oldText?.split('\n').length ?? 0,
        summary: item.oldText ? 'Modified file' : 'Created file',
      }));
    const toolEvent: ChatEvent = {
      id: randomUUID(),
      type: 'tool',
      sessionId,
      timestamp: now(),
      toolCallId: update.toolCallId,
      title: update.title ?? 'Tool call',
      kind: update.kind ?? 'other',
      status: update.status ?? undefined,
      locations: update.locations?.map((location) => location.path) ?? [],
      contentText: textContent || undefined,
      terminalId,
    };

    const events: ChatEvent[] = [toolEvent];

    if (diffItems && diffItems.length > 0) {
      events.push({
        id: randomUUID(),
        type: 'diffSummary',
        sessionId,
        timestamp: now(),
        diff: {
          source: 'tool',
          toolCallId: update.toolCallId,
          items: diffItems,
        },
      });
    }

    return events;
  }

  if (update.sessionUpdate === 'current_mode_update') {
    return [createStatusEvent(sessionId, 'processing', `Mode: ${update.currentModeId}`)];
  }

  if (update.sessionUpdate === 'session_info_update' && update.title) {
    return [createStatusEvent(sessionId, 'processing', `Session title updated to ${update.title}`)];
  }

  return [];
};
