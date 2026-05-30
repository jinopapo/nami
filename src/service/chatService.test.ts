/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_service'. Dependency is of type 'src_service' */
/* eslint-disable max-lines */
import { describe, expect, it } from 'vitest';
import type { SessionEvent } from '../model/chat';
import type { UiTask } from '../model/task';
import { chatService } from './chatService';

const createTask = (overrides: Partial<UiTask> = {}): UiTask => ({
  taskId: 'task-1',
  sessionId: 'session-1',
  cwd: '/tmp',
  projectWorkspacePath: '/project',
  taskWorkspacePath: '/project/.worktrees/task-1',
  taskBranchName: 'task/task-1',
  taskBranchManagement: 'system_managed',
  baseBranchName: 'main',
  reviewMergePolicy: 'merge_to_base',
  canMergeAfterReview: true,
  createdAt: '2026-03-18T00:00:00.000Z',
  updatedAt: '2026-03-18T00:00:00.000Z',
  mode: 'plan',
  lifecycleState: 'planning',
  runtimeState: 'running',
  workspaceStatus: 'ready',
  mergeStatus: 'idle',
  dependencyTaskIds: [],
  pendingDependencyTaskIds: [],
  ...overrides,
});

describe('chatService.getSessionStatus', () => {
  it('returns before_start before planning begins', () => {
    const status = chatService.getSessionStatus(
      createTask({
        lifecycleState: 'before_start',
        runtimeState: 'idle',
      }),
      undefined,
      [],
    );

    expect(status).toEqual({
      phase: 'before_start',
      label: '実施前',
      tone: 'idle',
    });
  });

  it('returns error when the task runtime has failed', () => {
    const status = chatService.getSessionStatus(
      createTask({ runtimeState: 'error' }),
      undefined,
      [],
    );

    expect(status).toEqual({
      phase: 'error',
      label: 'エラー',
      tone: 'waiting',
    });
  });

  it('returns aborted when the task was stopped by a human', () => {
    const status = chatService.getSessionStatus(
      createTask({ lifecycleState: 'executing', runtimeState: 'aborted' }),
      undefined,
      [],
    );

    expect(status).toEqual({
      phase: 'aborted',
      label: '停止中',
      tone: 'waiting',
    });
  });

  it('returns planning while a plan-mode task is running', () => {
    const status = chatService.getSessionStatus(createTask(), undefined, [
      {
        type: 'plan',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        entries: [{ content: 'plan', status: 'in_progress' }],
      },
    ] satisfies SessionEvent[]);

    expect(status).toEqual({
      phase: 'planning',
      label: '計画中',
      tone: 'running',
    });
  });

  it('returns awaiting confirmation after planning finishes', () => {
    const status = chatService.getSessionStatus(
      createTask({
        lifecycleState: 'awaiting_confirmation',
        runtimeState: 'completed',
      }),
      undefined,
      [],
    );

    expect(status).toEqual({
      phase: 'awaiting_confirmation',
      label: '確認待ち',
      tone: 'waiting',
    });
  });

  it('returns executing only after act mode starts', () => {
    const status = chatService.getSessionStatus(
      createTask({
        mode: 'act',
        lifecycleState: 'executing',
        runtimeState: 'running',
      }),
      undefined,
      [],
    );

    expect(status).toEqual({
      phase: 'executing',
      label: '実行中',
      tone: 'running',
    });
  });

  it('prioritizes permission waiting over lifecycle labels', () => {
    const task = createTask({
      mode: 'act',
      lifecycleState: 'executing',
      runtimeState: 'waiting_permission',
    });
    const events: SessionEvent[] = [
      {
        type: 'permissionRequest',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        approvalId: 'approval-1',
        title: 'Approve tool',
      },
    ];

    const status = chatService.getSessionStatus(
      task,
      chatService.getPendingUserAction(task, events),
      events,
    );

    expect(status).toEqual({
      phase: 'waiting_permission',
      label: 'ツール実行の許可待ち',
      tone: 'waiting',
    });
  });
});

describe('chatService.toDisplayItems', () => {
  it('converts auto check events into timeline items without mixing them with chat messages', () => {
    const items = chatService.toDisplayItems([
      {
        type: 'userMessage',
        role: 'user',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        text: 'fix it',
      },
      {
        type: 'autoCheckStarted',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:01.000Z',
        run: {
          autoCheckRunId: 'run-1',
          steps: [{ id: 'step-1', name: 'Lint', command: 'npm run lint' }],
        },
      },
      {
        type: 'autoCheckStep',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:02.000Z',
        step: {
          autoCheckRunId: 'run-1',
          stepId: 'step-1',
          name: 'Lint',
          command: 'npm run lint',
          phase: 'finished',
          success: false,
          exitCode: 1,
          output: 'failed\nout',
        },
      },
      {
        type: 'autoCheckFeedback',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:03.000Z',
        feedback: {
          autoCheckRunId: 'run-1',
          stepId: 'step-1',
          name: 'Lint',
          command: 'npm run lint',
          exitCode: 1,
          output: 'failed\nout',
          prompt: 'feedback',
        },
      },
    ] satisfies SessionEvent[]);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'userMessage', text: 'fix it' }),
        expect.objectContaining({
          type: 'autoCheckRun',
          autoCheckRunId: 'run-1',
        }),
        expect.objectContaining({ type: 'autoCheckStep', stepId: 'step-1' }),
        expect.objectContaining({
          type: 'autoCheckFeedback',
          prompt: 'feedback',
        }),
      ]),
    );
  });

  it('keeps read_files display informative when SDK input uses file objects', () => {
    const items = chatService.toDisplayItems([
      {
        type: 'toolCall',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        toolCallId: 'tool-1',
        toolKind: 'read',
        title: 'read_files',
        statusLabel: 'Processing',
        rawInput: {
          files: [
            {
              path: '/workspace/README.md',
              start_line: 1,
              end_line: 20,
            },
          ],
        },
        rawOutput: undefined,
        toolLog: {
          toolCallId: 'tool-1',
          toolKind: 'read',
          title: 'read_files',
          phase: 'start',
          status: 'processing',
          statusLabel: 'Processing',
        },
      },
    ] satisfies SessionEvent[]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'toolCall',
      toolCallId: 'tool-1',
      display: {
        variant: 'read',
        path: '/workspace/README.md',
        message: '/workspace/README.mdを読み込み中です',
      },
    });
  });

  it('renders read_files with multiple file paths on separate lines', () => {
    const items = chatService.toDisplayItems([
      {
        type: 'toolCall',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        toolCallId: 'tool-1',
        toolKind: 'read',
        title: 'read_files',
        statusLabel: 'Processing',
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
        rawOutput: undefined,
        toolLog: {
          toolCallId: 'tool-1',
          toolKind: 'read',
          title: 'read_files',
          phase: 'start',
          status: 'processing',
          statusLabel: 'Processing',
        },
      },
    ] satisfies SessionEvent[]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'toolCall',
      toolCallId: 'tool-1',
      display: {
        variant: 'read',
        path: '/workspace/README.md',
        message:
          '/workspace/README.mdを読み込み中です\n/workspace/src/App.tsxを読み込み中です',
      },
    });
  });

  it('keeps read_files display informative after completion when only output query remains', () => {
    const items = chatService.toDisplayItems([
      {
        type: 'toolCall',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        toolCallId: 'tool-1',
        toolKind: 'read',
        title: 'read_files',
        statusLabel: 'Processing',
        rawInput: {
          files: [
            {
              path: '/workspace/README.md',
              start_line: 1,
              end_line: 20,
            },
          ],
        },
        rawOutput: undefined,
        toolLog: {
          toolCallId: 'tool-1',
          toolKind: 'read',
          title: 'read_files',
          phase: 'start',
          status: 'processing',
          statusLabel: 'Processing',
        },
      },
      {
        type: 'toolCall',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:01.000Z',
        toolCallId: 'tool-1',
        toolKind: 'read',
        title: 'read_files',
        statusLabel: 'Completed',
        rawInput: undefined,
        rawOutput: [
          {
            query: '/workspace/README.md:1-20',
            result: 'content',
            success: true,
          },
        ],
        toolLog: {
          toolCallId: 'tool-1',
          toolKind: 'read',
          title: 'read_files',
          phase: 'complete',
          status: 'completed',
          statusLabel: 'Completed',
        },
      },
    ] satisfies SessionEvent[]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'toolCall',
      toolCallId: 'tool-1',
      rawInput: {
        files: [
          {
            path: '/workspace/README.md',
            start_line: 1,
            end_line: 20,
          },
        ],
      },
      display: {
        variant: 'read',
        path: '/workspace/README.md',
        message: '/workspace/README.mdを読み込み中です',
      },
    });
  });

  it('keeps a tool call visible after an assistant message chunk from the same SDK chunk', () => {
    const items = chatService.toDisplayItems([
      {
        type: 'assistantMessageChunk',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        text: '調べます',
      },
      {
        type: 'toolCall',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        toolCallId: 'tool-1',
        toolKind: 'read',
        title: 'read_files',
        statusLabel: 'Processing',
        rawInput: {
          files: [{ path: 'README.md', start_line: 1, end_line: 20 }],
        },
        toolLog: {
          toolCallId: 'tool-1',
          toolKind: 'read',
          title: 'read_files',
          phase: 'update',
          status: 'processing',
          statusLabel: 'Processing',
        },
      },
    ] satisfies SessionEvent[]);

    expect(items).toEqual([
      expect.objectContaining({ type: 'assistantMessage', text: '調べます' }),
      expect.objectContaining({
        type: 'toolCall',
        toolCallId: 'tool-1',
        display: {
          variant: 'read',
          path: 'README.md',
          message: 'README.mdを読み込み中です',
        },
      }),
    ]);
  });

  it('renders search_codebase queries on separate lines', () => {
    const items = chatService.toDisplayItems([
      {
        type: 'toolCall',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        toolCallId: 'tool-search',
        toolKind: 'read',
        title: 'search_codebase',
        statusLabel: 'Processing',
        rawInput: { queries: ['TaskWorkspaceService', 'chatService'] },
        toolLog: {
          toolCallId: 'tool-search',
          toolKind: 'read',
          title: 'search_codebase',
          phase: 'start',
          status: 'processing',
          statusLabel: 'Processing',
        },
      },
    ] satisfies SessionEvent[]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'toolCall',
      toolCallId: 'tool-search',
      display: {
        variant: 'read',
        path: undefined,
        message: 'TaskWorkspaceServiceを検索中です\nchatServiceを検索中です',
      },
    });
  });

  it('renders editor create as 作成中です', () => {
    const items = chatService.toDisplayItems([
      {
        type: 'toolCall',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        toolCallId: 'tool-editor-create',
        toolKind: 'edit',
        title: 'editor',
        statusLabel: 'Processing',
        rawInput: { path: 'docs/new-file.md', new_text: '# title\n' },
        toolLog: {
          toolCallId: 'tool-editor-create',
          toolKind: 'edit',
          title: 'editor',
          phase: 'start',
          status: 'processing',
          statusLabel: 'Processing',
        },
      },
    ] satisfies SessionEvent[]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'toolCall',
      toolCallId: 'tool-editor-create',
      display: {
        variant: 'read',
        path: 'docs/new-file.md',
        message: 'docs/new-file.mdを新規作成中です',
      },
    });
  });

  it('renders editor update as 更新中です', () => {
    const items = chatService.toDisplayItems([
      {
        type: 'toolCall',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        toolCallId: 'tool-editor-update',
        toolKind: 'edit',
        title: 'editor',
        statusLabel: 'Processing',
        rawInput: {
          path: 'README.md',
          old_text: 'before',
          new_text: 'after',
        },
        toolLog: {
          toolCallId: 'tool-editor-update',
          toolKind: 'edit',
          title: 'editor',
          phase: 'start',
          status: 'processing',
          statusLabel: 'Processing',
        },
      },
    ] satisfies SessionEvent[]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'toolCall',
      toolCallId: 'tool-editor-update',
      display: {
        variant: 'read',
        path: 'README.md',
        message: 'README.mdを編集中です',
      },
    });
  });

  it('keeps progress-only agent events out of visible timeline items', () => {
    const items = chatService.toDisplayItems([
      {
        type: 'progress',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        progressId: 'core:session_snapshot',
        title: 'セッションスナップショットを受信しました',
        status: 'running',
        detail: 'first',
      },
      {
        type: 'progress',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:01.000Z',
        progressId: 'core:session_snapshot',
        title: 'セッションスナップショットを受信しました',
        status: 'running',
        detail: 'second',
      },
    ] satisfies SessionEvent[]);

    expect(items).toHaveLength(0);
  });
});

describe('chatService.getTimelineAutoScrollState', () => {
  it('enables auto scroll only while the active task is running', () => {
    const runningState = chatService.getTimelineAutoScrollState(
      createTask(),
      [],
    );
    const idleState = chatService.getTimelineAutoScrollState(
      createTask({ lifecycleState: 'before_start', runtimeState: 'idle' }),
      [],
    );

    expect(runningState).toEqual({
      shouldAutoScroll: true,
      autoScrollKey: '0:empty',
    });
    expect(idleState).toEqual({
      shouldAutoScroll: false,
      autoScrollKey: '0:empty',
    });
  });

  it('changes the auto scroll key when the visible timeline content changes', () => {
    const baseItems = chatService.toDisplayItems([
      {
        type: 'assistantMessageChunk',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        text: 'hello',
      },
    ] satisfies SessionEvent[]);
    const updatedItems = chatService.toDisplayItems([
      {
        type: 'assistantMessageChunk',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        text: 'hello',
      },
      {
        type: 'assistantMessageChunk',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:01.000Z',
        text: ' world',
      },
    ] satisfies SessionEvent[]);

    const baseState = chatService.getTimelineAutoScrollState(
      createTask(),
      baseItems,
    );
    const updatedState = chatService.getTimelineAutoScrollState(
      createTask(),
      updatedItems,
    );

    expect(updatedState.autoScrollKey).not.toBe(baseState.autoScrollKey);
    expect(updatedState.shouldAutoScroll).toBe(true);
  });

  it('keeps the auto scroll key stable for equivalent display items', () => {
    const firstItems = chatService.toDisplayItems([
      {
        type: 'userMessage',
        role: 'user',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        text: 'fix it',
      },
    ] satisfies SessionEvent[]);
    const secondItems = chatService.toDisplayItems([
      {
        type: 'userMessage',
        role: 'user',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        text: 'fix it',
      },
    ] satisfies SessionEvent[]);

    expect(
      chatService.getTimelineAutoScrollState(createTask(), firstItems)
        .autoScrollKey,
    ).toBe(
      chatService.getTimelineAutoScrollState(createTask(), secondItems)
        .autoScrollKey,
    );
  });
});
