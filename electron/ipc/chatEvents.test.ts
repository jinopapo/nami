import { describe, expect, it } from 'vitest';
import { createApprovalEvent, createMessageEvent, createWorkspaceDiffEvent, normalizeSessionUpdate } from './chatEvents.js';

describe('normalizeSessionUpdate', () => {
  it('ignores thought chunks', () => {
    expect(
      normalizeSessionUpdate('session-1', {
        sessionUpdate: 'agent_thought_chunk',
        content: { type: 'text', text: 'internal' },
      }),
    ).toEqual([]);
  });

  it('maps message chunks into message events', () => {
    const [event] = normalizeSessionUpdate('session-1', {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'hello' },
    });

    expect(event).toMatchObject({
      type: 'message',
      sessionId: 'session-1',
      role: 'assistant',
      text: 'hello',
    });
  });

  it('maps message chunks into message events when text is provided at top level', () => {
    const [event] = normalizeSessionUpdate('session-1', {
      sessionUpdate: 'agent_message_chunk',
      text: 'hello from top level',
    } as never);

    expect(event).toMatchObject({
      type: 'message',
      sessionId: 'session-1',
      role: 'assistant',
      text: 'hello from top level',
    });
  });

  it('maps tool diff content into diff summary', () => {
    const events = normalizeSessionUpdate('session-1', {
      sessionUpdate: 'tool_call',
      toolCallId: 'tool-1',
      title: 'Edit file',
      kind: 'edit',
      status: 'completed',
      content: [{ type: 'diff', path: 'src/App.tsx', newText: 'next', oldText: 'prev' }],
    });

    expect(events.some((event) => event.type === 'diffSummary')).toBe(true);
  });
});

describe('createApprovalEvent', () => {
  it('marks approvals as resolved when requested', () => {
    const event = createApprovalEvent(
      'session-1',
      'approval-1',
      {
        sessionId: 'session-1',
        options: [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }],
        toolCall: { toolCallId: 'tool-1', title: 'Run command', kind: 'execute' },
      },
      true,
      'approve',
    );

    expect(event.type).toBe('approval');
    if (event.type === 'approval') {
      expect(event.approval.resolved).toBe(true);
      expect(event.approval.decision).toBe('approve');
    }
  });
});

describe('createMessageEvent', () => {
  it('creates a user message event', () => {
    expect(createMessageEvent('session-1', 'user', 'hello')).toMatchObject({
      type: 'message',
      sessionId: 'session-1',
      role: 'user',
      text: 'hello',
    });
  });
});

describe('createWorkspaceDiffEvent', () => {
  it('parses git numstat lines', () => {
    const event = createWorkspaceDiffEvent('session-1', ['10\t2\tsrc/App.tsx']);
    expect(event?.type).toBe('diffSummary');
  });
});
