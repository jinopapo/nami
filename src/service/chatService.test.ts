import { describe, expect, it } from 'vitest';
import type { SessionEvent, UiTask } from '../model/chat';
import { chatService } from './chatService';

const createTask = (overrides: Partial<UiTask> = {}): UiTask => ({
  taskId: 'task-1',
  sessionId: 'session-1',
  cwd: '/tmp',
  createdAt: '2026-03-18T00:00:00.000Z',
  updatedAt: '2026-03-18T00:00:00.000Z',
  mode: 'plan',
  lifecycleState: 'planning',
  runtimeState: 'running',
  ...overrides,
});

describe('chatService.getSessionStatus', () => {
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
});

describe('chatService.getTimelineAutoScrollState', () => {
  it('enables auto scroll only while the active task is running', () => {
    const runningState = chatService.getTimelineAutoScrollState(
      createTask(),
      [],
    );
    const idleState = chatService.getTimelineAutoScrollState(
      createTask({ runtimeState: 'completed' }),
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
