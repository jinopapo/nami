import { beforeEach, describe, expect, it } from 'vitest';
import type { UiEvent } from '../model/chat';
import { mergeMessageEvent, useChatStore } from './chatStore';

const createMessageEvent = (
  id: string,
  role: 'user' | 'assistant',
  text: string,
  timestamp = '2026-03-18T00:00:00.000Z',
): UiEvent => ({
  id,
  type: 'message',
  sessionId: 'session-1',
  timestamp,
  role,
  text,
});

describe('mergeMessageEvent', () => {
  it('merges consecutive assistant message chunks', () => {
    const events = [createMessageEvent('assistant-1', 'assistant', 'hel')];
    const merged = mergeMessageEvent(events, createMessageEvent('assistant-2', 'assistant', 'lo'));

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: 'assistant-1',
      text: 'hello',
    });
  });

  it('merges consecutive user message chunks', () => {
    const events = [createMessageEvent('user-1', 'user', 'こん')];
    const merged = mergeMessageEvent(events, createMessageEvent('user-2', 'user', 'にちは'));

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: 'user-1',
      text: 'こんにちは',
    });
  });

  it('starts a new message after a non-message event', () => {
    const events: UiEvent[] = [
      createMessageEvent('assistant-1', 'assistant', 'hello'),
      { id: 'tool-1', type: 'tool', sessionId: 'session-1', timestamp: '2026-03-18T00:00:01.000Z', title: 'Edit file' },
    ];
    const merged = mergeMessageEvent(events, createMessageEvent('assistant-2', 'assistant', ' world'));

    expect(merged).toHaveLength(3);
    expect(merged[2]).toMatchObject({
      id: 'assistant-2',
      text: ' world',
    });
  });

  it('starts a new message when the role changes', () => {
    const events = [createMessageEvent('user-1', 'user', 'hello')];
    const merged = mergeMessageEvent(events, createMessageEvent('assistant-1', 'assistant', 'hi'));

    expect(merged).toHaveLength(2);
    expect(merged[1]).toMatchObject({
      id: 'assistant-1',
      text: 'hi',
    });
  });
});

describe('chatStore appendEvent', () => {
  beforeEach(() => {
    useChatStore.setState({
      sessions: [],
      selectedSessionId: undefined,
      eventsBySession: {},
      draft: '',
      cwd: '',
      sending: false,
    });
  });

  it('keeps a single visible message while assistant chunks stream in', () => {
    const { appendEvent } = useChatStore.getState();

    appendEvent('session-1', createMessageEvent('assistant-1', 'assistant', 'hel'));
    appendEvent('session-1', createMessageEvent('assistant-2', 'assistant', 'lo'));

    expect(useChatStore.getState().eventsBySession['session-1']).toMatchObject([
      {
        id: 'assistant-1',
        text: 'hello',
      },
    ]);
  });
});
