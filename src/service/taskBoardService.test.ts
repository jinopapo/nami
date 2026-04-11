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
  it('returns merge failure labels and danger tone', () => {
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
      workspaceStatusLabel: 'マージ失敗（要対応）',
      mergeStatusLabel: 'マージ失敗',
      mergeFailureLabel: '事前チェック失敗',
      boardBadgeTone: 'danger',
    });
  });

  it('returns success tone for merged tasks', () => {
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

    expect(card).toMatchObject({
      workspaceStatusLabel: 'プロジェクトワークスペースへ統合済み',
      mergeStatusLabel: '統合済み',
      boardBadgeTone: 'success',
    });
  });
});
