import { beforeEach, describe, expect, it } from 'vitest';
import type { UiEvent, UiSession } from '../model/chat';
import { mergeMessageEvent, resolveSelectedSessionId, useChatStore } from './chatStore';

const createSession = (sessionId: string): UiSession => ({
  sessionId,
  cwd: `/tmp/${sessionId}`,
  createdAt: '2026-03-18T00:00:00.000Z',
  updatedAt: '2026-03-18T00:00:00.000Z',
  mode: 'act',
});

const createMessageEvent = (
  id: string,
  role: 'user' | 'assistant',
  text: string,
  timestamp = '2026-03-18T00:00:00.000Z',
  messageId?: string,
): UiEvent => ({
  id,
  type: 'message',
  sessionId: 'session-1',
  timestamp,
  role,
  text,
  messageId,
});

describe('mergeMessageEvent', () => {
  it('merges consecutive assistant message chunks', () => {
    const events = [createMessageEvent('assistant-1', 'assistant', 'hel', '2026-03-18T00:00:00.000Z', 'msg-1')];
    const merged = mergeMessageEvent(events, createMessageEvent('assistant-2', 'assistant', 'lo', '2026-03-18T00:00:01.000Z', 'msg-1'));

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: 'assistant-1',
      text: 'hello',
    });
  });

  it('does not merge consecutive messages without messageId', () => {
    const events = [createMessageEvent('user-1', 'user', 'こん')];
    const merged = mergeMessageEvent(events, createMessageEvent('user-2', 'user', 'にちは'));

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      id: 'user-1',
      text: 'こん',
    });
    expect(merged[1]).toMatchObject({
      id: 'user-2',
      text: 'にちは',
    });
  });

  it('does not merge consecutive messages when messageId differs', () => {
    const events = [createMessageEvent('assistant-1', 'assistant', 'hel', '2026-03-18T00:00:00.000Z', 'msg-1')];
    const merged = mergeMessageEvent(events, createMessageEvent('assistant-2', 'assistant', 'lo', '2026-03-18T00:00:01.000Z', 'msg-2'));

    expect(merged).toHaveLength(2);
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

    appendEvent('session-1', createMessageEvent('assistant-1', 'assistant', 'hel', '2026-03-18T00:00:00.000Z', 'msg-1'));
    appendEvent('session-1', createMessageEvent('assistant-2', 'assistant', 'lo', '2026-03-18T00:00:01.000Z', 'msg-1'));

    expect(useChatStore.getState().eventsBySession['session-1']).toMatchObject([
      {
        id: 'assistant-1',
        text: 'hello',
      },
    ]);
  });

  it('keeps user submitted messages separate when no messageId is present', () => {
    const { appendEvent } = useChatStore.getState();

    appendEvent('session-1', createMessageEvent('user-1', 'user', '最初の依頼'));
    appendEvent('session-1', createMessageEvent('user-2', 'user', '次の依頼'));

    expect(useChatStore.getState().eventsBySession['session-1']).toMatchObject([
      {
        id: 'user-1',
        text: '最初の依頼',
      },
      {
        id: 'user-2',
        text: '次の依頼',
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

  it('updates a session when a newer summary is upserted', () => {
    useChatStore.setState({
      sessions: [{ ...createSession('session-1'), updatedAt: '2026-03-18T00:00:00.000Z' }],
      selectedSessionId: 'session-1',
      eventsBySession: {},
      draft: '',
      cwd: '',
      sending: false,
      bootError: null,
    });

    useChatStore.getState().upsertSession({ ...createSession('session-1'), updatedAt: '2026-03-18T00:01:00.000Z' });

    expect(useChatStore.getState().sessions[0]).toMatchObject({ updatedAt: '2026-03-18T00:01:00.000Z' });
  });
});
