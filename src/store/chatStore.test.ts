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
  lifecycleState: 'executing',
  runtimeState: 'running',
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
      sessionsByTask: {},
      draft: '',
      cwd: '',
      bootError: null,
    });
  });

  it('adds an optimistic user message before task creation completes', () => {
    const { temporaryTaskId } = useChatStore.getState().beginOptimisticSession({ prompt: 'hello nami' });

    expect(useChatStore.getState().selectedTaskId).toBe(temporaryTaskId);
    expect(useChatStore.getState().sessionsByTask[temporaryTaskId]?.events).toHaveLength(1);
    expect(useChatStore.getState().sessionsByTask[temporaryTaskId]?.events[0]).toMatchObject({ type: 'userMessage', role: 'user', text: 'hello nami' });
  });

  it('aggregates assistant streaming chunks into a single message', () => {
    useChatStore.setState({
      tasks: [],
      selectedTaskId: undefined,
      sessionsByTask: {
        'task-1': {
          taskId: 'task-1',
          sessionId: 'session-task-1',
          events: [],
        },
      },
      draft: '',
      cwd: '',
      bootError: null,
    });
    useChatStore.getState().applyUiEvent('task-1', {
      type: 'assistantMessageChunk',
      role: 'assistant',
      delivery: 'confirmed',
      taskId: 'task-1',
      sessionId: 'session-task-1',
      timestamp: '2026-03-18T00:00:00.000Z',
      text: 'hello',
    });
    useChatStore.getState().applyUiEvent('task-1', {
      type: 'assistantMessageChunk',
      role: 'assistant',
      delivery: 'confirmed',
      taskId: 'task-1',
      sessionId: 'session-task-1',
      timestamp: '2026-03-18T00:00:01.000Z',
      text: ' world',
    });
    useChatStore.getState().applyUiEvent('task-1', {
      type: 'assistantMessageCompleted',
      role: 'assistant',
      delivery: 'confirmed',
      taskId: 'task-1',
      sessionId: 'session-task-1',
      timestamp: '2026-03-18T00:00:02.000Z',
      reason: 'end_turn',
    });

    expect(useChatStore.getState().sessionsByTask['task-1']?.events).toHaveLength(3);
  });

  it('falls back to the first available task when current selection disappears', () => {
    useChatStore.setState({
      tasks: [createTask('task-1')],
      selectedTaskId: 'missing-task',
      sessionsByTask: {},
      draft: '',
      cwd: '',
      bootError: null,
    });

    useChatStore.getState().setTasks([createTask('task-1'), createTask('task-2')]);

    expect(useChatStore.getState().selectedTaskId).toBe('task-1');
  });

  it('updates a task when a newer summary is upserted', () => {
    useChatStore.setState({
      tasks: [{ ...createTask('task-1'), updatedAt: '2026-03-18T00:00:00.000Z' }],
      selectedTaskId: 'task-1',
      sessionsByTask: {},
      draft: '',
      cwd: '',
      bootError: null,
    });

    useChatStore.getState().upsertTask({ ...createTask('task-1'), updatedAt: '2026-03-18T00:01:00.000Z' });

    expect(useChatStore.getState().tasks[0]).toMatchObject({ updatedAt: '2026-03-18T00:01:00.000Z' });
  });

  it('updates task state when task state change is applied separately', () => {
    useChatStore.setState({
      tasks: [{ ...createTask('task-1'), runtimeState: 'running', updatedAt: '2026-03-18T00:00:00.000Z' }],
      selectedTaskId: 'task-1',
      sessionsByTask: {},
      draft: '',
      cwd: '',
      bootError: null,
    });

    useChatStore.getState().updateTaskState({ taskId: 'task-1', runtimeState: 'completed', updatedAt: '2026-03-18T00:02:00.000Z' });

    expect(useChatStore.getState().tasks[0]).toMatchObject({ runtimeState: 'completed', updatedAt: '2026-03-18T00:02:00.000Z' });
  });
});
