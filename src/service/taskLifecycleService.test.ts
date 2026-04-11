import { describe, expect, it } from 'vitest';
import type { UiTask } from '../model/chat';
import { taskLifecycleService } from './taskLifecycleService';

const createTask = (lifecycleState: UiTask['lifecycleState']): UiTask => ({
  taskId: 'task-1',
  sessionId: 'session-1',
  cwd: '/tmp',
  projectWorkspacePath: '/project',
  taskWorkspacePath: '/project/.worktrees/task-1',
  taskBranchName: 'task/task-1',
  baseBranchName: 'main',
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

  it('returns only complete action while awaiting review', () => {
    expect(
      taskLifecycleService.getTaskLifecycleActions(
        createTask('awaiting_review'),
      ),
    ).toEqual([
      {
        key: 'complete-task',
        label: '完了にする',
        nextState: 'completed',
        tone: 'primary',
      },
    ]);
  });
});
