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
