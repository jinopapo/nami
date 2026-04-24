/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_parts'. Dependency is of type 'src_parts' */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ReviewDetailPanel from './ReviewDetailPanel';

describe('ReviewDetailPanel', () => {
  it('renders side-by-side diff and commit area on commit tab', () => {
    const html = renderToStaticMarkup(
      <ReviewDetailPanel
        activeTab="commit"
        diffFiles={[
          {
            path: 'src/example.ts',
            status: 'modified',
            oldPath: 'src/example.ts',
            newPath: 'src/example.ts',
            hunks: [
              {
                header: '@@ -1,1 +1,1 @@',
                rows: [
                  {
                    left: {
                      lineNumber: 1,
                      text: 'const before = 1;',
                      changeType: 'removed',
                    },
                    right: {
                      lineNumber: 1,
                      text: 'const after = 2;',
                      changeType: 'added',
                    },
                  },
                ],
              },
            ],
          },
        ]}
        isLoading={false}
        error={null}
        commitMessage=""
        isCommitting={false}
        shouldMergeAfterReview={true}
        onTabChange={vi.fn()}
        onCommitMessageChange={vi.fn()}
        onCommit={vi.fn()}
        chatTimeline={<div>timeline</div>}
        chatComposer={<div>composer</div>}
      />,
    );

    expect(html).toContain('修正前');
    expect(html).toContain('修正後');
    expect(html).toContain('src/example.ts');
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('min-w-[1100px]');
    expect(html).toContain('shrink-0 overflow-hidden rounded-2xl');
    expect(html).toContain('shrink-0 border-t border-slate-400/10');
    expect(html).toContain('コミットメッセージを入力');
    expect(html).toContain('そのまま merge を実行します');
    expect(html).toContain('disabled');
  });

  it('renders skip-merge copy when review merge is disabled', () => {
    const html = renderToStaticMarkup(
      <ReviewDetailPanel
        activeTab="commit"
        diffFiles={[]}
        isLoading={false}
        error={null}
        commitMessage="feat: commit"
        isCommitting={false}
        shouldMergeAfterReview={false}
        onTabChange={vi.fn()}
        onCommitMessageChange={vi.fn()}
        onCommit={vi.fn()}
        chatTimeline={<div>timeline</div>}
        chatComposer={<div>composer</div>}
      />,
    );

    expect(html).toContain('merge は実行しません');
  });

  it('renders chat content on chat tab', () => {
    const html = renderToStaticMarkup(
      <ReviewDetailPanel
        activeTab="chat"
        diffFiles={[]}
        isLoading={false}
        error={null}
        commitMessage="feat: commit"
        isCommitting={false}
        shouldMergeAfterReview={true}
        onTabChange={vi.fn()}
        onCommitMessageChange={vi.fn()}
        onCommit={vi.fn()}
        chatTimeline={<div>timeline</div>}
        chatComposer={<div>composer</div>}
      />,
    );

    expect(html).toContain('timeline');
    expect(html).toContain('composer');
    expect(html).not.toContain('コミットメッセージを入力');
  });
});
