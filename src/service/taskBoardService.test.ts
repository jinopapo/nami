/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_service'. Dependency is of type 'src_service' */
import { describe, expect, it } from 'vitest';
import type { UiTask } from '../model/chat';
import { taskBoardService } from './taskBoardService';

const createTask = (overrides: Partial<UiTask> = {}): UiTask => ({
  taskId: 'task-1',
  sessionId: 'session-1',
  cwd: '/project/.worktrees/task-1',
  projectWorkspacePath: '/project',
  taskWorkspacePath: '/project/.worktrees/task-1',
  taskBranchName: 'task/task-1',
  baseBranchName: 'main',
  createdAt: '2026-03-18T00:00:00.000Z',
  updatedAt: '2026-03-18T00:00:00.000Z',
  mode: 'act',
  lifecycleState: 'awaiting_review',
  runtimeState: 'completed',
  workspaceStatus: 'ready',
  mergeStatus: 'idle',
  ...overrides,
});

describe('taskBoardService', () => {
  it('returns compact cards without workspace and merge display fields', () => {
    const columns = taskBoardService.getTaskCardsByColumn(
      [
        createTask({
          workspaceStatus: 'merge_failed',
          mergeStatus: 'failed',
          mergeFailureReason: 'hook_failed',
        }),
      ],
      {},
    );

    const reviewColumn = columns.find(
      (column) => column.state === 'awaiting_review',
    );
    const card = reviewColumn?.cards[0];

    expect(card).toMatchObject({
      taskId: 'task-1',
      title: 'Task task-1',
      mode: 'act',
      runtimeState: 'completed',
    });
    expect(card).not.toHaveProperty('workspaceStatusLabel');
    expect(card).not.toHaveProperty('mergeStatusLabel');
    expect(card).not.toHaveProperty('mergeFailureLabel');
    expect(card).not.toHaveProperty('projectWorkspacePath');
    expect(card).not.toHaveProperty('taskWorkspacePath');
  });

  it('keeps cards grouped by lifecycle state', () => {
    const columns = taskBoardService.getTaskCardsByColumn(
      [
        createTask({
          workspaceStatus: 'merged',
          mergeStatus: 'succeeded',
          lifecycleState: 'completed',
        }),
      ],
      {},
    );

    const completedColumn = columns.find(
      (column) => column.state === 'completed',
    );
    const card = completedColumn?.cards[0];

    expect(completedColumn?.cards).toHaveLength(1);
    expect(card?.taskId).toBe('task-1');
  });
});
