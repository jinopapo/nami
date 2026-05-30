/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_service'. Dependency is of type 'src_service' */
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
  it('uses read_files input file objects as a hint while target path is unresolved', () => {
    const display = createDisplay(
      createToolCallEvent({
        title: 'read_files',
        rawInput: {
          files: [
            {
              path: '/workspace/README.md',
              start_line: 1,
              end_line: 20,
            },
          ],
        },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: '/workspace/README.md',
      message: '/workspace/README.mdを読み込み中です',
    });
  });

  it('renders read_files with multiple file paths on separate lines', () => {
    const display = createDisplay(
      createToolCallEvent({
        title: 'read_files',
        rawInput: {
          files: [
            {
              path: '/workspace/README.md',
              start_line: 1,
              end_line: 20,
            },
            {
              path: '/workspace/src/App.tsx',
              start_line: 1,
              end_line: 40,
            },
          ],
        },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: '/workspace/README.md',
      message:
        '/workspace/README.mdを読み込み中です\n/workspace/src/App.tsxを読み込み中です',
    });
  });

  it('uses read_files output query as a resolved hint when rawInput is unavailable', () => {
    const display = createDisplay(
      createToolCallEvent({
        title: 'read_files',
        rawInput: undefined,
        rawOutput: [
          {
            query: '/workspace/README.md:1-20',
            result: 'content',
            success: true,
          },
        ],
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: '/workspace/README.md',
      message: '/workspace/README.mdを読み込み中です',
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

  it('uses SDK tool title with files input for read_files display', () => {
    const display = createDisplay(
      createToolCallEvent({
        title: 'read_files',
        rawInput: {
          files: [{ path: 'src/App.tsx', start_line: 1, end_line: 20 }],
        },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: 'src/App.tsx',
      message: 'src/App.tsxを読み込み中です',
    });
  });

  it('uses SDK search_codebase title and queries for display', () => {
    const display = createDisplay(
      createToolCallEvent({
        title: 'search_codebase',
        rawInput: { queries: ['TaskWorkspaceService', 'chatService'] },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: undefined,
      message: 'TaskWorkspaceServiceを検索中です\nchatServiceを検索中です',
    });
  });

  it('uses SDK run_commands title and commands for display', () => {
    const display = createDisplay(
      createToolCallEvent({
        title: 'run_commands',
        toolKind: 'execute',
        rawInput: { commands: ['npm run test'] },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: undefined,
      message: 'npm run test実行中です',
    });
  });

  it('renders run_commands with multiple commands on separate lines', () => {
    const display = createDisplay(
      createToolCallEvent({
        title: 'run_commands',
        toolKind: 'execute',
        rawInput: { commands: ['npm run test', 'npm run lint'] },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: undefined,
      message: 'npm run test実行中です\nnpm run lint実行中です',
    });
  });

  it('uses run_commands output query when rawInput is unavailable', () => {
    const display = createDisplay(
      createToolCallEvent({
        title: 'run_commands',
        toolKind: 'execute',
        rawInput: undefined,
        rawOutput: [
          {
            query: "printf 'RUN_COMMANDS_OK\\n'",
            result: 'RUN_COMMANDS_OK\n',
            success: true,
          },
        ],
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: undefined,
      message: "printf 'RUN_COMMANDS_OK\\n'実行中です",
    });
  });

  it('falls back safely for run_commands when commands cannot be resolved', () => {
    const display = createDisplay(
      createToolCallEvent({
        title: 'run_commands',
        toolKind: 'execute',
        rawInput: undefined,
        rawOutput: undefined,
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: undefined,
      message: 'コマンドを実行中です',
    });
  });

  it('uses SDK editor title as edit display when rawInput.tool is unavailable', () => {
    const display = createDisplay(
      createToolCallEvent({
        title: 'editor',
        toolKind: 'edit',
        rawInput: { path: 'README.md' },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: 'README.md',
      message: 'README.mdを編集中です',
    });
  });

  it('uses SDK editor title as create display when rawInput indicates file creation', () => {
    const display = createDisplay(
      createToolCallEvent({
        title: 'editor',
        toolKind: 'edit',
        rawInput: { path: 'docs/new-file.md', new_text: '# title\n' },
      }),
    );

    expect(display).toEqual({
      variant: 'read',
      path: 'docs/new-file.md',
      message: 'docs/new-file.mdを新規作成中です',
    });
  });

  it('returns default display for unsupported tool titles', () => {
    const display = createDisplay(
      createToolCallEvent({
        toolKind: 'read',
        title: 'unsupported_tool',
        rawInput: { path: '/tmp/example.ts' },
      }),
    );

    expect(display).toEqual({
      variant: 'default',
      showDetails: true,
    });
  });
});
