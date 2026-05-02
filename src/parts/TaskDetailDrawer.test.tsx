/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_parts'. Dependency is of type 'src_parts' */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TaskDetailDrawer from './TaskDetailDrawer';

describe('TaskDetailDrawer', () => {
  it('does not render action buttons section when no actions are provided', () => {
    const html = renderToStaticMarkup(
      <TaskDetailDrawer
        isOpen
        title="task"
        subtitle="subtitle"
        statusLabel="実施前"
        statusTone="idle"
        actions={[]}
        onAction={vi.fn()}
        onClose={vi.fn()}
        timeline={<div>timeline</div>}
        composer={<div>composer</div>}
      />,
    );

    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).not.toContain('計画を開始する');
  });

  it('renders top panel content when provided', () => {
    const html = renderToStaticMarkup(
      <TaskDetailDrawer
        isOpen
        title="task"
        subtitle="subtitle"
        statusLabel="レビュー待ち"
        statusTone="waiting"
        actions={[]}
        onAction={vi.fn()}
        onClose={vi.fn()}
        topPanel={<div>review panel</div>}
      />,
    );

    expect(html).toContain('review panel');
    expect(html).not.toContain('timeline');
    expect(html).not.toContain('composer');
  });

  it('uses display status badge instead of raw lifecycle state badge', () => {
    const html = renderToStaticMarkup(
      <TaskDetailDrawer
        isOpen
        task={{
          taskId: 'task-1',
          sessionId: 'session-1',
          cwd: '/repo',
          projectWorkspacePath: '/repo',
          taskWorkspacePath: '/repo/task-1',
          taskBranchName: 'task/task-1',
          taskBranchManagement: 'system_managed',
          baseBranchName: 'main',
          reviewMergePolicy: 'merge_to_base',
          canMergeAfterReview: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          mode: 'plan',
          lifecycleState: 'awaiting_confirmation',
          runtimeState: 'waiting_human_decision',
          workspaceStatus: 'ready',
          mergeStatus: 'idle',
          dependencyTaskIds: [],
          pendingDependencyTaskIds: [],
        }}
        title="task"
        subtitle="subtitle"
        statusLabel="確認待ち"
        statusTone="waiting"
        actions={[]}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('確認待ち');
    expect(html).not.toContain('awaiting_confirmation');
  });
});
