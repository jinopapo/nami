import { beforeEach, describe, expect, it } from 'vitest';
import type { UiTask } from '../model/chat';
import { resolveSelectedTaskId, useChatStore } from './chatStore';

const createTask = (taskId: string): UiTask => ({
  taskId,
  sessionId: `session-${taskId}`,
  cwd: `/tmp/${taskId}`,
  createdAt: '2026-03-18T00:00:00.000Z',
  updatedAt: '2026-03-18T00:00:00.000Z',
  mode: 'act',
  state: 'running',
});

describe('resolveSelectedTaskId', () => {
  it('keeps the selected task when it still exists', () => {
    expect(resolveSelectedTaskId([createTask('task-1'), createTask('task-2')], 'task-2')).toBe('task-2');
  });

  it('falls back to the first task when selected task is missing', () => {
    expect(resolveSelectedTaskId([createTask('task-1'), createTask('task-2')], 'task-3')).toBe('task-1');
  });
});

describe('chatStore', () => {
  beforeEach(() => {
    useChatStore.setState({
      tasks: [],
      selectedTaskId: undefined,
      eventsByTask: {},
      draft: '',
      cwd: '',
      sending: false,
      bootError: null,
    });
  });

  it('appends events for the selected task', () => {
    useChatStore.getState().setTasks([createTask('task-1')]);
    useChatStore.getState().selectTask('task-1');
    useChatStore.getState().appendEvent('task-1', {
      type: 'taskStateChanged',
      taskId: 'task-1',
      sessionId: 'session-task-1',
      timestamp: '2026-03-18T00:00:00.000Z',
      state: 'running',
    });

    expect(useChatStore.getState().selectedTaskId).toBe('task-1');
    expect(useChatStore.getState().eventsByTask['task-1']).toHaveLength(1);
  });

  it('falls back to the first available task when current selection disappears', () => {
    useChatStore.setState({
      tasks: [createTask('task-1')],
      selectedTaskId: 'missing-task',
      eventsByTask: {},
      draft: '',
      cwd: '',
      sending: false,
      bootError: null,
    });

    useChatStore.getState().setTasks([createTask('task-1'), createTask('task-2')]);

    expect(useChatStore.getState().selectedTaskId).toBe('task-1');
  });

  it('updates a task when a newer summary is upserted', () => {
    useChatStore.setState({
      tasks: [{ ...createTask('task-1'), updatedAt: '2026-03-18T00:00:00.000Z' }],
      selectedTaskId: 'task-1',
      eventsByTask: {},
      draft: '',
      cwd: '',
      sending: false,
      bootError: null,
    });

    useChatStore.getState().upsertTask({ ...createTask('task-1'), updatedAt: '2026-03-18T00:01:00.000Z' });

    expect(useChatStore.getState().tasks[0]).toMatchObject({ updatedAt: '2026-03-18T00:01:00.000Z' });
  });
});
