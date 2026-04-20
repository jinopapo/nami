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
});
