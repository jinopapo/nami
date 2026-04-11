import type { ReactNode } from 'react';
import type { TaskDetailSummary, UiTask } from '../model/chat';
import type { TaskLifecycleAction } from '../service/taskLifecycleService';

type TaskDetailDrawerProps = {
  isOpen: boolean;
  task?: UiTask;
  title: string;
  subtitle: string;
  statusLabel: string;
  statusTone: 'idle' | 'running' | 'waiting';
  detailSummary?: TaskDetailSummary;
  actions: TaskLifecycleAction[];
  onAction: (action: TaskLifecycleAction) => void;
  onClose: () => void;
  autoCheckPanel?: ReactNode;
  timeline: ReactNode;
  composer: ReactNode;
};

const statusToneClassName = {
  idle: 'border-slate-400/16 bg-slate-400/12 text-slate-300',
  running: 'border-blue-500/28 bg-blue-500/14 text-blue-300',
  waiting: 'border-amber-500/28 bg-amber-500/16 text-orange-300',
} as const;

export default function TaskDetailDrawer({
  isOpen,
  task,
  title,
  subtitle,
  statusLabel,
  statusTone,
  detailSummary,
  actions,
  onAction,
  onClose,
  autoCheckPanel,
  timeline,
  composer,
}: TaskDetailDrawerProps) {
  return (
    <>
      <div
        className={`fixed inset-0 z-20 bg-slate-950/45 transition ${isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed right-0 top-0 z-30 flex h-screen w-full max-w-[760px] flex-col border-l border-slate-400/14 bg-[linear-gradient(180deg,rgba(8,14,23,0.98),rgba(10,16,27,0.97))] shadow-[-24px_0_72px_rgba(0,0,0,0.35)] transition-transform duration-200 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-400/10 px-5 py-5 md:px-6">
          <div className="min-w-0">
            <p className="m-0 text-xs uppercase tracking-[0.14em] text-slate-500">
              Task detail
            </p>
            <h3 className="m-0 mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-100">
              {title}
            </h3>
            <p className="m-0 mt-2 text-sm leading-6 text-slate-400">
              {subtitle}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {task ? (
                <span className="rounded-full bg-slate-400/10 px-3 py-1 text-xs text-slate-300">
                  {task.lifecycleState}
                </span>
              ) : null}
              {task ? (
                <span className="rounded-full bg-slate-400/10 px-3 py-1 text-xs text-slate-300">
                  {task.mode}
                </span>
              ) : null}
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusToneClassName[statusTone]}`}
              >
                {statusLabel}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="rounded-full bg-slate-400/10 px-3 py-2 text-sm text-slate-300 transition hover:-translate-y-px"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>

        <div className="border-b border-slate-400/10 px-5 py-4 md:px-6">
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.key}
                type="button"
                className={
                  action.tone === 'primary'
                    ? 'rounded-full bg-linear-to-br from-amber-500 to-orange-400 px-3 py-2 text-sm font-bold text-slate-900 transition hover:-translate-y-px'
                    : 'rounded-full border border-slate-400/12 bg-slate-400/10 px-3 py-2 text-sm text-slate-300 transition hover:-translate-y-px'
                }
                onClick={() => onAction(action)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {task && detailSummary ? (
          <div className="border-b border-slate-400/10 px-5 py-5 md:px-6">
            <div className="grid gap-5 md:grid-cols-2">
              <section>
                <p className="m-0 text-xs uppercase tracking-[0.12em] text-slate-500">
                  Workspace 情報
                </p>
                <dl className="m-0 mt-3 space-y-3">
                  {detailSummary.workspaceItems.map((item) => (
                    <div key={item.label}>
                      <dt className="text-xs text-slate-500">{item.label}</dt>
                      <dd className="m-0 mt-1 break-words text-sm text-slate-200">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section>
                <p className="m-0 text-xs uppercase tracking-[0.12em] text-slate-500">
                  Merge 状態
                </p>
                <dl className="m-0 mt-3 space-y-3">
                  {detailSummary.mergeItems.map((item) => (
                    <div key={item.label}>
                      <dt className="text-xs text-slate-500">{item.label}</dt>
                      <dd className="m-0 mt-1 break-words text-sm text-slate-200">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {detailSummary.nextActionMessage ? (
                  <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
                    <p className="m-0 text-xs uppercase tracking-[0.12em] text-amber-300">
                      次にやること
                    </p>
                    <p className="m-0 mt-2 text-sm leading-6 text-slate-200">
                      {detailSummary.nextActionMessage}
                    </p>
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">
          {autoCheckPanel}
          {timeline}
          {composer}
        </div>
      </aside>
    </>
  );
}
