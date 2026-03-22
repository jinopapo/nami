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