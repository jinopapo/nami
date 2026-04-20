/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_service'. Dependency is of type 'src_service' */
import { describe, expect, it } from 'vitest';
import type { UiTask } from '../model/chat';
import { chatPanelReviewService } from './chatPanelReviewService';

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
  mode: lifecycleState === 'awaiting_review' ? 'act' : 'plan',
  lifecycleState,
  runtimeState: lifecycleState === 'awaiting_review' ? 'completed' : 'running',
  workspaceStatus: 'ready',
  mergeStatus: 'idle',
});

describe('chatPanelReviewService', () => {
  it('builds review diff input only for review tasks', () => {
    expect(
      chatPanelReviewService.createReviewDiffInput(
        createTask('awaiting_review'),
      ),
    ).toEqual({
      taskWorkspacePath: '/project/.worktrees/task-1',
      baseBranchName: 'main',
    });

    expect(
      chatPanelReviewService.createReviewDiffInput(createTask('executing')),
    ).toBeUndefined();
  });

  it('builds commit input only when message is present', () => {
    expect(
      chatPanelReviewService.createCommitReviewInput(
        createTask('awaiting_review'),
        '  ship it  ',
      ),
    ).toEqual({
      taskWorkspacePath: '/project/.worktrees/task-1',
      message: 'ship it',
    });

    expect(
      chatPanelReviewService.createCommitReviewInput(
        createTask('awaiting_review'),
        '   ',
      ),
    ).toBeUndefined();
  });

  it('updates review state for loading and commit transitions', () => {
    const initial = chatPanelReviewService.createReviewPanelState();
    const loading = chatPanelReviewService.startReviewDiffLoading(initial);
    const loaded = chatPanelReviewService.finishReviewDiffLoading(loading, [
      { path: 'src/a.ts', status: 'modified', hunks: [] },
    ]);
    const committing = chatPanelReviewService.startReviewCommit({
      ...loaded,
      reviewCommitMessage: 'done',
    });
    const committed = chatPanelReviewService.finishReviewCommit(committing);

    expect(loading).toMatchObject({
      isReviewDiffLoading: true,
      reviewError: null,
    });
    expect(loaded).toMatchObject({
      isReviewDiffLoading: false,
      reviewDiffFiles: [{ path: 'src/a.ts', status: 'modified', hunks: [] }],
    });
    expect(committing).toMatchObject({
      isReviewCommitRunning: true,
      reviewError: null,
    });
    expect(committed).toMatchObject({
      isReviewCommitRunning: false,
      reviewCommitMessage: '',
    });
  });
});
