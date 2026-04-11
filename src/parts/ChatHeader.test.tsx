import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ChatHeader from './ChatHeader';

describe('ChatHeader', () => {
  it('shows current branch when available', () => {
    const html = renderToStaticMarkup(
      <ChatHeader
        workspaceLabel="~/repo"
        currentBranch="feature/show-branch"
        bootError={null}
        isSettingsAvailable
        onChooseDirectory={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );

    expect(html).toContain('feature/show-branch');
    expect(html).toContain('branch');
  });

  it('does not show branch pill when branch is unavailable', () => {
    const html = renderToStaticMarkup(
      <ChatHeader
        workspaceLabel="No directory selected"
        currentBranch={null}
        bootError={null}
        isSettingsAvailable={false}
        onChooseDirectory={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );

    expect(html).not.toContain('branch');
  });
});