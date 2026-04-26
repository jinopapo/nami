/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_service'. Dependency is of type 'src_service' */
import { describe, expect, it } from 'vitest';
import type { UiTask } from '../model/task';
import { taskLifecycleService } from './taskLifecycleService';

const createTask = (
  lifecycleState: UiTask['lifecycleState'],
  overrides: Partial<UiTask> = {},
): UiTask => ({
  taskId: 'task-1',
  sessionId: 'session-1',
  cwd: '/tmp',
  projectWorkspacePath: '/project',
  taskWorkspacePath: '/project/.worktrees/task-1',
  taskBranchName: 'task/task-1',
  taskBranchManagement: 'system_managed',
  baseBranchName: 'main',
  reviewMergePolicy: 'merge_to_base',
  canMergeAfterReview: true,
  createdAt: '2026-03-18T00:00:00.000Z',
  updatedAt: '2026-03-18T00:00:00.000Z',
  mode:
    lifecycleState === 'executing' ||
    lifecycleState === 'awaiting_review' ||
    lifecycleState === 'completed'
      ? 'act'
      : 'plan',
  lifecycleState,
  runtimeState: lifecycleState === 'before_start' ? 'idle' : 'running',
  workspaceStatus: 'ready',
  mergeStatus: 'idle',
  ...overrides,
});

describe('taskLifecycleService', () => {
  it('returns start action before task execution begins', () => {
    expect(
      taskLifecycleService.getTaskLifecycleActions(createTask('before_start')),
    ).toEqual([
      {
        key: 'start-planning',
        label: '計画を開始する',
        nextState: 'planning',
        tone: 'primary',
      },
    ]);
  });

  it('returns no actions while planning', () => {
    expect(
      taskLifecycleService.getTaskLifecycleActions(createTask('planning')),
    ).toEqual([]);
  });

  it('returns confirmation actions while awaiting confirmation', () => {
    expect(
      taskLifecycleService.getTaskLifecycleActions(
        createTask('awaiting_confirmation'),
      ),
    ).toEqual([
      { key: 'rework-plan', label: '計画を練り直す', nextState: 'planning' },
      {
        key: 'start-executing',
        label: '実行に移す',
        nextState: 'executing',
        tone: 'primary',
      },
    ]);
  });

  it('returns no footer actions while awaiting review', () => {
    expect(
      taskLifecycleService.getTaskLifecycleActions(
        createTask('awaiting_review'),
      ),
    ).toEqual([]);
  });

  it('returns retry action when a planning or executing task is in error', () => {
    expect(
      taskLifecycleService.getTaskLifecycleActions(
        createTask('planning', { runtimeState: 'error' }),
      ),
    ).toEqual([
      {
        key: 'retry-error',
        label: '再試行する',
        nextState: 'planning',
        tone: 'primary',
      },
    ]);

    expect(
      taskLifecycleService.getTaskLifecycleActions(
        createTask('executing', { runtimeState: 'error', mode: 'act' }),
      ),
    ).toEqual([
      {
        key: 'retry-error',
        label: '再試行する',
        nextState: 'executing',
        tone: 'primary',
      },
    ]);
  });

  it('separates retry action for composer and hides it from drawer actions', () => {
    expect(
      taskLifecycleService.getLifecycleActionPresentation('error', [
        {
          key: 'retry-error',
          label: '再試行する',
          nextState: 'executing',
          tone: 'primary',
        },
      ]),
    ).toEqual({
      retryAction: {
        key: 'retry-error',
        label: '再試行する',
        nextState: 'executing',
        tone: 'primary',
      },
      drawerActions: [],
      composerDecisionActions: [],
    });
  });

  it('routes non-retry decision actions to composer before execution starts', () => {
    const actions = [
      {
        key: 'start-planning',
        label: '計画を開始する',
        nextState: 'planning' as const,
        tone: 'primary' as const,
      },
    ];

    expect(
      taskLifecycleService.getLifecycleActionPresentation(
        'before_start',
        actions,
      ),
    ).toEqual({
      retryAction: undefined,
      drawerActions: [],
      composerDecisionActions: actions,
    });
  });
});
