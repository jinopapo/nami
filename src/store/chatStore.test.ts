import { beforeEach, describe, expect, it } from 'vitest';
import type { UiEvent, UiSession } from '../model/chat';
import { mergeMessageEvent, resolveSelectedSessionId, useChatStore } from './chatStore';

const createSession = (sessionId: string): UiSession => ({
  sessionId,
  title: `Session ${sessionId}`,
  cwd: `/tmp/${sessionId}`,
  createdAt: '2026-03-18T00:00:00.000Z',
  updatedAt: '2026-03-18T00:00:00.000Z',
  mode: 'act',
  live: true,
  archived: false,
});

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

  it('starts a new message when the session changes', () => {
    const events = [createMessageEvent('assistant-1', 'assistant', 'hello')];
    const merged = mergeMessageEvent(events, {
      ...createMessageEvent('assistant-2', 'assistant', ' world'),
      sessionId: 'session-2',
    });

    expect(merged).toHaveLength(2);
    expect(merged[1]).toMatchObject({
      id: 'assistant-2',
      sessionId: 'session-2',
      text: ' world',
    });
  });
});

describe('resolveSelectedSessionId', () => {
  it('keeps the selected session when it still exists', () => {
    expect(resolveSelectedSessionId([createSession('session-1'), createSession('session-2')], 'session-2')).toBe('session-2');
  });

  it('falls back to the first session when selected session is missing', () => {
    expect(resolveSelectedSessionId([createSession('session-1'), createSession('session-2')], 'session-3')).toBe('session-1');
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
      bootError: null,
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

  it('preserves events for the currently selected session', () => {
    useChatStore.getState().setSessions([createSession('session-1')]);
    useChatStore.getState().selectSession('session-1');

    useChatStore.getState().appendEvent('session-1', createMessageEvent('user-1', 'user', 'hello'));

    expect(useChatStore.getState().selectedSessionId).toBe('session-1');
    expect(useChatStore.getState().eventsBySession['session-1']).toMatchObject([
      {
        id: 'user-1',
        text: 'hello',
      },
    ]);
  });

  it('falls back to the first available session when current selection disappears', () => {
    useChatStore.setState({
      sessions: [createSession('session-1')],
      selectedSessionId: 'missing-session',
      eventsBySession: {},
      draft: '',
      cwd: '',
      sending: false,
      bootError: null,
    });

    useChatStore.getState().setSessions([createSession('session-1'), createSession('session-2')]);

    expect(useChatStore.getState().selectedSessionId).toBe('session-1');
  });
});
