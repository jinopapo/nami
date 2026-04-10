import { describe, expect, it } from 'vitest';
import type { SessionEvent } from '../../model/chat';
import { chatService } from '../chatService';

const createToolCallEvent = (
  overrides: Partial<Extract<SessionEvent, { type: 'toolCall' }>> = {},
): Extract<SessionEvent, { type: 'toolCall' }> => ({
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

const createDisplay = (event: Extract<SessionEvent, { type: 'toolCall' }>) => {
  const items = chatService.toDisplayItems([event]);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ type: 'toolCall' });

  const [item] = items;
  if (item.type !== 'toolCall') {
    throw new Error('toolCall display was not created');
  }

  return item.display;
};

describe('toolCall display', () => {
  it('returns simplified read display from rawOutput.path when tool is readFile', () => {
    const display = createDisplay(
      createToolCallEvent({
        rawInput: { tool: 'readFile', path: 'nami' },
        rawOutput: {
          tool: 'readFile',
          path: 'README.md',
          content: '/Users/ji-no/ghq/github.com/jinopapo/nami/README.md',
        },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: 'README.md',
      message: 'README.md 読み込み中',
    });
  });

  it('uses rawInput.path as a hint while readFile target path is unresolved', () => {
    const display = createDisplay(
      createToolCallEvent({ rawInput: { tool: 'readFile', path: 'nami' } }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: undefined,
      message: 'nami 内のファイルを特定中',
    });
  });

  it('falls back to unresolved readFile message when both raw paths are unavailable', () => {
    const display = createDisplay(
      createToolCallEvent({ rawInput: { tool: 'readFile' } }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: undefined,
      message: '読み込み対象を特定中',
    });
  });

  it('falls back safely when both rawInput and rawOutput are undefined', () => {
    const display = createDisplay(
      createToolCallEvent({ rawInput: undefined, rawOutput: undefined }),
    );

    expect(display).toEqual({
      variant: 'default',
      showDetails: true,
    });
  });

  it('returns simplified read display even when toolKind is other', () => {
    const display = createDisplay(
      createToolCallEvent({
        toolKind: 'other',
        rawInput: { tool: 'readFile', path: 'nami' },
        rawOutput: {
          tool: 'readFile',
          path: 'README.md',
        },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: 'README.md',
      message: 'README.md 読み込み中',
    });
  });

  it('returns simplified read display from rawOutput when rawInput is unavailable', () => {
    const display = createDisplay(
      createToolCallEvent({
        rawInput: undefined,
        rawOutput: {
          tool: 'readFile',
          path: 'docs/clineTool/readFile.md',
        },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: 'docs/clineTool/readFile.md',
      message: 'docs/clineTool/readFile.md 読み込み中',
    });
  });

  it('returns simplified read display when rawInput.tool is listFilesRecursive', () => {
    const display = createDisplay(
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

  it('returns simplified read display when rawInput.tool is listCodeDefinitionNames', () => {
    const display = createDisplay(
      createToolCallEvent({
        rawInput: { tool: 'listCodeDefinitionNames', path: 'electron/service' },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: 'electron/service',
      message: 'electron/service を分析中',
    });
  });

  it('falls back when listCodeDefinitionNames path is unavailable', () => {
    const display = createDisplay(
      createToolCallEvent({
        rawInput: { tool: 'listCodeDefinitionNames' },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: undefined,
      message: 'コード定義を分析中',
    });
  });

  it('returns simplified read display when rawInput.tool is searchFiles', () => {
    const display = createDisplay(
      createToolCallEvent({
        rawInput: {
          tool: 'searchFiles',
          path: 'nami',
          content: '',
          regex: 'readFile|listFilesRecursive|editFile',
          filePattern: '*.{ts,md}',
          operationIsLocatedInWorkspace: true,
        },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: 'nami',
      message: 'nami内をreadFile|listFilesRecursive|editFileで検索中',
    });
  });

  it('falls back when search regex is unavailable', () => {
    const display = createDisplay(
      createToolCallEvent({
        rawInput: {
          tool: 'searchFiles',
          path: 'nami',
        },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: 'nami',
      message: 'nami内を検索中',
    });
  });

  it('returns simplified edit display when rawInput.tool is editedExistingFile', () => {
    const display = createDisplay(
      createToolCallEvent({
        toolKind: 'edit',
        rawInput: {
          tool: 'editedExistingFile',
          path: 'README.md',
          content: '%%bash\napply_patch <<"EOF"',
          operationIsLocatedInWorkspace: true,
        },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: 'README.md',
      message: 'README.mdを変更中',
    });
  });

  it('falls back when editedExistingFile path is unavailable', () => {
    const display = createDisplay(
      createToolCallEvent({
        toolKind: 'edit',
        rawInput: {
          tool: 'editedExistingFile',
        },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: undefined,
      message: 'ファイルを変更中',
    });
  });

  it('returns default display for non-readFile tools', () => {
    const display = createDisplay(
      createToolCallEvent({
        toolKind: 'read',
        rawInput: { tool: 'editFile', path: '/tmp/example.ts' },
      }),
    );

    expect(display).toEqual({
      variant: 'default',
      showDetails: true,
    });
  });
});
