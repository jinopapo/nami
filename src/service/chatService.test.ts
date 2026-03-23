import { describe, expect, it } from 'vitest';
import type { SessionEvent } from '../model/chat';
import { chatService } from './chatService';

describe('chatService.toDisplayItems', () => {
  it('returns an empty array when events is empty', () => {
    expect(chatService.toDisplayItems([])).toEqual([]);
  });

  it('aggregates assistant streaming chunks into a single display item', () => {
    const events: SessionEvent[] = [
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
      {
        type: 'assistantMessageCompleted',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:02.000Z',
        reason: 'end_turn',
      },
    ];

    expect(chatService.toDisplayItems(events)).toEqual([
      {
        type: 'assistantMessage',
        id: 'assistant-message-0',
        role: 'assistant',
        timestamp: '2026-03-18T00:00:02.000Z',
        text: 'hello world',
        status: 'sent',
      },
    ]);
  });
});

describe('chatService.getSessionStatus', () => {
  it('returns idle when there are no events', () => {
    expect(chatService.getSessionStatus(undefined, undefined, [])).toEqual({
      phase: 'idle',
      label: '入力待ち',
      tone: 'idle',
    });
  });

  it('returns running right after an optimistic user message', () => {
    const events: SessionEvent[] = [{
      type: 'userMessage',
      role: 'user',
      delivery: 'optimistic',
      taskId: 'task-1',
      timestamp: '2026-03-18T00:00:00.000Z',
      text: 'hello',
    }];

    expect(chatService.getSessionStatus(undefined, undefined, events)).toEqual({
      phase: 'running',
      label: 'AIが作業中',
      tone: 'running',
    });
  });

  it('returns waiting_permission when permission request is pending', () => {
    const events: SessionEvent[] = [{
      type: 'permissionRequest',
      role: 'assistant',
      delivery: 'confirmed',
      taskId: 'task-1',
      sessionId: 'session-1',
      timestamp: '2026-03-18T00:00:00.000Z',
      approvalId: 'approval-1',
      title: 'Need permission',
    }];

    expect(chatService.getSessionStatus({
      taskId: 'task-1',
      sessionId: 'session-1',
      cwd: '/tmp/task-1',
      createdAt: '2026-03-18T00:00:00.000Z',
      updatedAt: '2026-03-18T00:00:00.000Z',
      mode: 'act',
      state: 'waiting_permission',
    }, { type: 'permission', approvalId: 'approval-1', title: 'Need permission', timestamp: '2026-03-18T00:00:00.000Z' }, events)).toEqual({
      phase: 'waiting_permission',
      label: 'ツール実行の許可待ち',
      tone: 'waiting',
    });
  });

  it('returns running after permission response followed by running state', () => {
    const events: SessionEvent[] = [
      {
        type: 'permissionRequest',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        approvalId: 'approval-1',
        title: 'Need permission',
      },
      {
        type: 'permissionResponse',
        role: 'user',
        delivery: 'optimistic',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:01.000Z',
        approvalId: 'approval-1',
        decision: 'approve',
      },
      {
        type: 'taskStateChanged',
        role: 'assistant',
        delivery: 'optimistic',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:02.000Z',
        state: 'running',
        reason: 'permission_resolved',
      },
    ];

    expect(chatService.getSessionStatus(undefined, undefined, events)).toEqual({
      phase: 'running',
      label: 'AIが作業中',
      tone: 'running',
    });
  });

  it('returns idle after completed state', () => {
    const events: SessionEvent[] = [{
      type: 'taskStateChanged',
      role: 'assistant',
      delivery: 'confirmed',
      taskId: 'task-1',
      sessionId: 'session-1',
      timestamp: '2026-03-18T00:00:02.000Z',
      state: 'completed',
      reason: 'end_turn',
    }];

    expect(chatService.getSessionStatus(undefined, undefined, events)).toEqual({
      phase: 'idle',
      label: '入力待ち',
      tone: 'idle',
    });
  });

  it('prioritizes waiting_permission over running signals', () => {
    const events: SessionEvent[] = [
      {
        type: 'userMessage',
        role: 'user',
        delivery: 'optimistic',
        taskId: 'task-1',
        timestamp: '2026-03-18T00:00:00.000Z',
        text: 'hello',
      },
      {
        type: 'permissionRequest',
        role: 'assistant',
        delivery: 'confirmed',
        taskId: 'task-1',
        sessionId: 'session-1',
        timestamp: '2026-03-18T00:00:01.000Z',
        approvalId: 'approval-1',
        title: 'Need permission',
      },
    ];

    expect(chatService.getSessionStatus(undefined, { type: 'permission', approvalId: 'approval-1', title: 'Need permission', timestamp: '2026-03-18T00:00:01.000Z' }, events)).toEqual({
      phase: 'waiting_permission',
      label: 'ツール実行の許可待ち',
      tone: 'waiting',
    });
  });
});