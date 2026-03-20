import { describe, expect, it } from 'vitest';
import { createErrorEvent, createPermissionRequestEvent, createRawSessionUpdateEvent, createTaskStartedEvent, createTaskStateChangedEvent } from './chatEvents.js';

describe('chatEvents', () => {
  it('creates taskStarted event', () => {
    const event = createTaskStartedEvent({
      taskId: 'task-1',
      sessionId: 'session-1',
      cwd: '/tmp',
      createdAt: '2026-03-18T00:00:00.000Z',
      updatedAt: '2026-03-18T00:00:00.000Z',
      mode: 'act',
      state: 'running',
    });

    expect(event).toMatchObject({ type: 'taskStarted', task: { taskId: 'task-1', sessionId: 'session-1' } });
  });

  it('creates raw session update event', () => {
    const event = createRawSessionUpdateEvent('task-1', 'session-1', {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'hello' },
    });

    expect(event).toMatchObject({ type: 'sessionUpdate', taskId: 'task-1', sessionId: 'session-1' });
  });

  it('creates permission request event', () => {
    const event = createPermissionRequestEvent('task-1', 'session-1', 'approval-1', {
      sessionId: 'session-1',
      options: [{ optionId: 'allow_once', name: 'Allow Once', kind: 'allow_once' }],
      toolCall: { toolCallId: 'tool-1', title: 'Run command', kind: 'execute' },
    });

    expect(event).toMatchObject({ type: 'permissionRequest', approvalId: 'approval-1' });
  });

  it('creates task state changed event', () => {
    expect(createTaskStateChangedEvent('task-1', 'session-1', 'completed', 'end_turn')).toMatchObject({
      type: 'taskStateChanged',
      state: 'completed',
      reason: 'end_turn',
    });
  });

  it('creates error event', () => {
    expect(createErrorEvent('boom', 'session-1', 'task-1')).toMatchObject({ type: 'error', message: 'boom' });
  });
});
