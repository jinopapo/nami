import { describe, expect, it } from 'vitest';
import type { SessionEvent } from '../../model/chat';
import { toolCallDisplayService } from './toolCallDisplayService';

const createToolCallEvent = (overrides: Partial<Extract<SessionEvent, { type: 'toolCall' }>> = {}): Extract<SessionEvent, { type: 'toolCall' }> => ({
  type: 'toolCall',
  role: 'assistant',
  delivery: 'confirmed',
  taskId: 'task-1',
  sessionId: 'session-1',
  timestamp: '2026-03-18T00:00:00.000Z',
  toolCallId: 'tool-1',
  toolKind: 'read',
  title: 'Read file',
  statusLabel: 'Running tool',
  rawInput: { path: '/tmp/example.ts' },
  rawOutput: undefined,
  toolLog: {
    toolCallId: 'tool-1',
    toolKind: 'read',
    title: 'Read file',
    phase: 'start',
    statusLabel: 'Running tool',
  },
  content: undefined,
  locations: undefined,
  details: undefined,
  ...overrides,
});

describe('toolCallDisplayService', () => {
  it('returns simplified read display with path when toolKind is read', () => {
    const display = toolCallDisplayService.create(createToolCallEvent());

    expect(display).toEqual({
      variant: 'read',
      path: '/tmp/example.ts',
      message: '/tmp/example.ts 読み込み中',
    });
  });

  it('falls back when read path is unavailable', () => {
    const display = toolCallDisplayService.create(createToolCallEvent({ rawInput: {} }));

    expect(display).toEqual({
      variant: 'read',
      path: undefined,
      message: 'ファイル読み込み中',
    });
  });

  it('returns default display for non-read tools', () => {
    const display = toolCallDisplayService.create(createToolCallEvent({ toolKind: 'edit' }));

    expect(display).toEqual({
      variant: 'default',
      showDetails: true,
    });
  });
});