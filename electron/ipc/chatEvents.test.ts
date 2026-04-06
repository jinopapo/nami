import { describe, expect, it } from 'vitest';
import {
  createAssistantMessageCompletedEvent,
  createChatRuntimeStateChangedEvent,
  createErrorEvent,
  createPermissionRequestEvent,
  createRawSessionUpdateEvent,
} from './chatEvents.js';

describe('chatEvents', () => {
  it('creates raw session update event', () => {
    const event = createRawSessionUpdateEvent('task-1', 'session-1', {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'hello' },
    });

    expect(event).toMatchObject({
      type: 'sessionUpdate',
      taskId: 'task-1',
      sessionId: 'session-1',
    });
  });

  it('creates permission request event', () => {
    const event = createPermissionRequestEvent(
      'task-1',
      'session-1',
      'turn-1',
      'approval-1',
      {
        sessionId: 'session-1',
        options: [
          { optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' },
        ],
        toolCall: {
          toolCallId: 'tool-1',
          title: 'Run command',
          kind: 'execute',
        },
      },
    );

    expect(event).toMatchObject({
      type: 'permissionRequest',
      approvalId: 'approval-1',
    });
  });

  it('creates task state changed event', () => {
    expect(
      createChatRuntimeStateChangedEvent(
        'task-1',
        'session-1',
        'turn-1',
        'completed',
        'end_turn',
      ),
    ).toMatchObject({
      type: 'chatRuntimeStateChanged',
      state: 'completed',
      reason: 'end_turn',
    });
  });

  it('creates assistant message completed event', () => {
    expect(
      createAssistantMessageCompletedEvent(
        'task-1',
        'session-1',
        'turn-1',
        'end_turn',
      ),
    ).toMatchObject({
      type: 'assistantMessageCompleted',
      taskId: 'task-1',
      sessionId: 'session-1',
      reason: 'end_turn',
    });
  });

  it('creates error event', () => {
    expect(createErrorEvent('boom', 'session-1', 'task-1')).toMatchObject({
      type: 'error',
      message: 'boom',
    });
  });
});
