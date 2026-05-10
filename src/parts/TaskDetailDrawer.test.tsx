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
          taskBranchName: 'task/task-1',
          taskBranchManagement: 'system_managed',
          canMergeAfterReview: true,
          mode: 'plan',
          dependencyTaskIds: [],
          pendingDependencyTaskIds: [],
        }}
        title="task"
        subtitle="subtitle"
        statusLabel="確認待ち"
        statusTone="waiting"
        actions={[]}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('確認待ち');
    expect(html).not.toContain('awaiting_confirmation');
  });
});
