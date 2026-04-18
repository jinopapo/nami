import type { ReactNode } from 'react';
import type { ReviewTabKey, UiReviewDiffFile } from '../model/chat';

type ReviewDetailPanelProps = {
  activeTab: ReviewTabKey;
  diffFiles: UiReviewDiffFile[];
  isLoading: boolean;
  error: string | null;
  commitMessage: string;
  isCommitting: boolean;
  onTabChange: (tab: ReviewTabKey) => void;
  onCommitMessageChange: (value: string) => void;
  onCommit: () => void;
  chatTimeline: ReactNode;
  chatComposer: ReactNode;
};

const tabClassName = (isActive: boolean) =>
  `rounded-full px-4 py-2 text-sm font-medium transition ${
    isActive
      ? 'bg-linear-to-br from-amber-500 to-orange-400 text-slate-900'
      : 'bg-slate-400/10 text-slate-300 hover:-translate-y-px'
  }`;

const changeClassName = {
  context: 'bg-slate-950/30 text-slate-300',
  added: 'bg-emerald-500/10 text-emerald-200',
  removed: 'bg-rose-500/10 text-rose-200',
  empty: 'bg-slate-950/15 text-slate-600',
} as const;

const diffTableClassName = 'min-w-[1100px]';

const renderDiffFiles = (files: UiReviewDiffFile[]) => {
  if (files.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10 text-sm text-slate-400">
        差分はありません。
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
      <div className="flex flex-col gap-4">
        {files.map((file) => (
          <section
            key={`${file.status}-${file.path}`}
            className="shrink-0 overflow-hidden rounded-2xl border border-slate-400/10 bg-slate-950/45"
          >
            <header className="flex flex-wrap items-center gap-3 border-b border-slate-400/10 px-4 py-3">
              <span className="rounded-full bg-slate-400/10 px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.08em] text-slate-300">
                {file.status}
              </span>
              <strong className="text-sm text-slate-100">{file.path}</strong>
              {file.oldPath && file.oldPath !== file.path ? (
                <span className="text-xs text-slate-500">
                  from {file.oldPath}
                </span>
              ) : null}
            </header>
            <div className="divide-y divide-slate-400/8">
              {file.hunks.map((hunk) => (
                <div key={`${file.path}-${hunk.header}`}>
                  <div className="border-b border-slate-400/8 bg-slate-900/70 px-4 py-2 font-mono text-[0.72rem] text-slate-400">
                    {hunk.header}
                  </div>
                  <div className="overflow-x-auto">
                    <div className={diffTableClassName}>
                      <div className="grid grid-cols-2 divide-x divide-slate-400/8">
                        <div className="border-b border-slate-400/8 bg-slate-900/40 px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          修正前
                        </div>
                        <div className="border-b border-slate-400/8 bg-slate-900/40 px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          修正後
                        </div>
                      </div>
                      {hunk.rows.map((row, index) => (
                        <div
                          key={`${file.path}-${hunk.header}-${index}`}
                          className="grid grid-cols-2 divide-x divide-slate-400/8"
                        >
                          {[row.left, row.right].map((cell, cellIndex) => (
                            <div
                              key={`${file.path}-${hunk.header}-${index}-${cellIndex}`}
                              className={`grid min-h-8 grid-cols-[56px_minmax(0,1fr)] gap-3 px-3 py-1.5 font-mono text-xs ${changeClassName[cell.changeType]}`}
                            >
                              <span className="select-none text-right text-slate-500">
                                {cell.lineNumber ?? ''}
                              </span>
                              <span className="whitespace-pre-wrap break-words">
                                {cell.text || ' '}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default function ReviewDetailPanel({
  activeTab,
  diffFiles,
  isLoading,
  error,
  commitMessage,
  isCommitting,
  onTabChange,
  onCommitMessageChange,
  onCommit,
  chatTimeline,
  chatComposer,
}: ReviewDetailPanelProps) {
  const isCommitDisabled = isCommitting || !commitMessage.trim();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-400/10 px-5 py-4 md:px-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={tabClassName(activeTab === 'chat')}
            onClick={() => onTabChange('chat')}
          >
            チャット
          </button>
          <button
            type="button"
            className={tabClassName(activeTab === 'commit')}
            onClick={() => onTabChange('commit')}
          >
            修正確認 / commit
          </button>
        </div>
      </div>

      {activeTab === 'chat' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {chatTimeline}
          {chatComposer}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {error ? (
            <div className="mx-4 mt-4 rounded-2xl border border-rose-400/24 bg-rose-950/20 px-4 py-3 text-sm text-rose-200 md:mx-6">
              {error}
            </div>
          ) : null}
          {isLoading ? (
            <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10 text-sm text-slate-400">
              差分を読み込んでいます...
            </div>
          ) : (
            renderDiffFiles(diffFiles)
          )}
          <div className="shrink-0 border-t border-slate-400/10 px-4 py-4 md:px-6">
            <div className="rounded-[28px] border border-slate-400/14 bg-[rgba(12,19,31,0.96)] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.3)]">
              <textarea
                className="min-h-24 w-full resize-none border-0 bg-transparent p-0 text-inherit outline-none disabled:cursor-not-allowed disabled:opacity-60"
                value={commitMessage}
                onChange={(event) => onCommitMessageChange(event.target.value)}
                placeholder="コミットメッセージを入力"
                disabled={isCommitting}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  commit 後に完了へ遷移し、そのまま merge を実行します。
                </span>
                <button
                  type="button"
                  className="min-w-[120px] rounded-full bg-linear-to-br from-amber-500 to-orange-400 px-4 py-2.5 font-bold text-slate-900 transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isCommitDisabled}
                  onClick={onCommit}
                >
                  {isCommitting ? 'Committing...' : 'Commit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
