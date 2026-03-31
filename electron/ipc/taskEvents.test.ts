import { describe, expect, it } from 'vitest';
import { createTaskCreatedEvent, createTaskLifecycleStateChangedEvent } from './taskEvents.js';

describe('taskEvents', () => {
  it('creates taskCreated event', () => {
    const event = createTaskCreatedEvent({
      taskId: 'task-1',
      sessionId: 'session-1',
      cwd: '/tmp',
      createdAt: '2026-03-18T00:00:00.000Z',
      updatedAt: '2026-03-18T00:00:00.000Z',
      mode: 'act',
      lifecycleState: 'executing',
      runtimeState: 'running',
    });

    expect(event).toMatchObject({ type: 'taskCreated', task: { taskId: 'task-1', sessionId: 'session-1' } });
  });

  it('creates task lifecycle state changed event', () => {
    expect(createTaskLifecycleStateChangedEvent('task-1', 'session-1', 'awaiting_review', 'end_turn')).toMatchObject({
      type: 'taskLifecycleStateChanged',
      state: 'awaiting_review',
      reason: 'end_turn',
    });
  });
});