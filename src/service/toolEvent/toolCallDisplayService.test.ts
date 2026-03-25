import { describe, expect, it } from 'vitest';
import type { SessionEvent } from '../../model/chat';
import { toolCallDisplayRepository } from '../../repository/toolEvent/toolCallDisplayRepository';

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
  rawInput: { tool: 'readFile', path: '/tmp/example.ts' },
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

describe('toolCallDisplayRepository', () => {
  it('returns simplified read display when rawInput.tool is readFile', () => {
    const display = toolCallDisplayRepository.create(createToolCallEvent());

    expect(display).toEqual({
      variant: 'read',
      path: '/tmp/example.ts',
      message: '/tmp/example.ts 読み込み中',
    });
  });

  it('falls back when read path is unavailable', () => {
    const display = toolCallDisplayRepository.create(createToolCallEvent({ rawInput: { tool: 'readFile' } }));

    expect(display).toEqual({
      variant: 'read',
      path: undefined,
      message: 'ファイル読み込み中',
    });
  });

  it('returns simplified read display even when toolKind is other', () => {
    const display = toolCallDisplayRepository.create(createToolCallEvent({ toolKind: 'other' }));

    expect(display).toEqual({
      variant: 'read',
      path: '/tmp/example.ts',
      message: '/tmp/example.ts 読み込み中',
    });
  });

  it('returns simplified read display when rawInput.tool is listFilesRecursive', () => {
    const display = toolCallDisplayRepository.create(
      createToolCallEvent({
        rawInput: { tool: 'listFilesRecursive', path: '/tmp' },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: '/tmp',
      message: '/tmp 読み込み中',
    });
  });

  it('returns default display for non-readFile tools', () => {
    const display = toolCallDisplayRepository.create(createToolCallEvent({ toolKind: 'read', rawInput: { tool: 'editFile', path: '/tmp/example.ts' } }));

    expect(display).toEqual({
      variant: 'default',
      showDetails: true,
    });
  });
});