/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_service'. Dependency is of type 'src_service' */
import { describe, expect, it } from 'vitest';
import type { UiChatSession } from '../model/chat';
import type { UiTask } from '../model/task';
import { chatPanelViewStateService } from './chatPanelViewStateService';

const createTask = (taskId: string): UiTask => ({
  taskId,
  sessionId: `session-${taskId}`,
  cwd: '/tmp',
  projectWorkspacePath: '/project',
  taskWorkspacePath: `/project/.worktrees/${taskId}`,
  taskBranchName: `task/${taskId}`,
  taskBranchManagement: 'system_managed',
  baseBranchName: 'main',
  reviewMergePolicy: 'merge_to_base',
  canMergeAfterReview: true,
  createdAt: '2026-03-18T00:00:00.000Z',
  updatedAt: '2026-03-18T00:00:00.000Z',
  mode: 'plan',
  lifecycleState: 'planning',
  runtimeState: 'running',
  workspaceStatus: 'ready',
  mergeStatus: 'idle',
  dependencyTaskIds: [],
  pendingDependencyTaskIds: [],
});

const createSession = (taskId: string, text: string): UiChatSession => ({
  taskId,
  sessionId: `session-${taskId}`,
  events: [
    {
      type: 'userMessage',
      role: 'user',
      delivery: 'confirmed',
      taskId,
      sessionId: `session-${taskId}`,
      timestamp: '2026-03-18T00:00:00.000Z',
      text,
    },
  ],
});

describe('chatPanelViewStateService', () => {
  it('finds active task and session from selected task id', () => {
    const taskA = createTask('task-a');
    const taskB = createTask('task-b');
    const sessions = {
      'task-a': createSession('task-a', 'hello'),
      'task-b': createSession('task-b', 'world'),
    };

    expect(
      chatPanelViewStateService.getActiveTask([taskA, taskB], 'task-b'),
    ).toEqual(taskB);
    expect(
      chatPanelViewStateService.getActiveSession(sessions, 'task-a'),
    ).toEqual(sessions['task-a']);
  });

  it('builds active title from the first user message or task fallback', () => {
    const task = createTask('task-a');
    const session = createSession('task-a', 'Implement a detailed change');

    expect(chatPanelViewStateService.getActiveTitle(task, session)).toBe(
      'Implement a detailed change',
    );
    expect(chatPanelViewStateService.getActiveTitle(task, undefined)).toBe(
      'Task task-a',
    );
    expect(chatPanelViewStateService.getActiveTitle(undefined, undefined)).toBe(
      '新しいタスク',
    );
  });

  it('detects whether workspace creation is still pending', () => {
    expect(
      chatPanelViewStateService.isTaskWorkspaceInitializing(
        'pending-1',
        'pending-1',
      ),
    ).toBe(true);
    expect(
      chatPanelViewStateService.isTaskWorkspaceInitializing(
        'pending-1',
        'task-1',
      ),
    ).toBe(false);
  });

  it('detects whether the transition from before start to planning is still pending', () => {
    const task = {
      ...createTask('task-a'),
      lifecycleState: 'before_start' as const,
    };

    expect(
      chatPanelViewStateService.isPlanningTransitionInitializing(
        {
          taskId: 'task-a',
          nextState: 'planning',
        },
        task,
      ),
    ).toBe(true);
    expect(
      chatPanelViewStateService.isPlanningTransitionInitializing(
        {
          taskId: 'task-a',
          nextState: 'planning',
        },
        { ...task, lifecycleState: 'planning' },
      ),
    ).toBe(false);
    expect(
      chatPanelViewStateService.isPlanningTransitionInitializing(
        {
          taskId: 'task-b',
          nextState: 'planning',
        },
        task,
      ),
    ).toBe(false);
  });
});
