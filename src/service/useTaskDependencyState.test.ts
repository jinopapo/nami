/* eslint-disable boundaries/element-types -- Service tests exercise service-layer helpers directly. */
import { describe, expect, it } from 'vitest';
import type { UiChatSession } from '../model/chat';
import type { UiTask } from '../model/task';
import { buildDependencyOptions } from './useTaskDependencyState';

const createTask = (
  taskId: string,
  overrides: Partial<UiTask> = {},
): UiTask => ({
  taskId,
  sessionId: `${taskId}-session`,
  cwd: '/project',
  projectWorkspacePath: '/project',
  taskWorkspacePath: `/project/.worktrees/${taskId}`,
  taskBranchName: `task/${taskId}`,
  taskBranchManagement: 'system_managed',
  baseBranchName: 'main',
  reviewMergePolicy: 'merge_to_base',
  canMergeAfterReview: true,
  createdAt: '2026-05-04T00:00:00.000Z',
  updatedAt: '2026-05-04T00:00:00.000Z',
  mode: 'plan',
  lifecycleState: 'before_start',
  runtimeState: 'idle',
  workspaceStatus: 'ready',
  mergeStatus: 'idle',
  dependencyTaskIds: [],
  pendingDependencyTaskIds: [],
  ...overrides,
});

const createSession = (taskId: string, text: string): UiChatSession => ({
  taskId,
  sessionId: `${taskId}-session`,
  events: [
    {
      type: 'userMessage',
      role: 'user',
      delivery: 'confirmed',
      taskId,
      sessionId: `${taskId}-session`,
      timestamp: '2026-05-04T00:00:00.000Z',
      text,
    },
  ],
});

describe('buildDependencyOptions', () => {
  it('excludes completed tasks from dependency candidates', () => {
    const options = buildDependencyOptions(
      [
        createTask('active-task'),
        createTask('completed-task', { lifecycleState: 'completed' }),
        createTask('preserve-task', { reviewMergePolicy: 'preserve_branch' }),
      ],
      {
        'active-task': createSession('active-task', 'active task prompt'),
        'completed-task': createSession('completed-task', 'completed prompt'),
        'preserve-task': createSession('preserve-task', 'preserve prompt'),
      },
    );

    expect(options).toEqual([
      {
        taskId: 'active-task',
        label: 'active task prompt',
        description: 'before_start / active-task',
      },
    ]);
  });

  it('falls back to a generated label when no user message exists', () => {
    const options = buildDependencyOptions([createTask('12345678-abcdef')], {});

    expect(options).toEqual([
      {
        taskId: '12345678-abcdef',
        label: 'Task 12345678',
        description: 'before_start / 12345678-abcdef',
      },
    ]);
  });
});
