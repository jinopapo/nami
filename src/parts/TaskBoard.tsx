import type {
  TaskBoardCard,
  TaskBoardColumn,
} from '../service/taskBoardService';

type TaskBoardProps = {
  columns: Array<TaskBoardColumn & { cards: TaskBoardCard[] }>;
  selectedTaskId?: string;
  workspaceLabel: string;
  onCreateTask: () => void;
  onOpenTask: (taskId: string) => void;
};

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const runtimeTone = {
  idle: 'border-slate-400/15 bg-slate-400/10 text-slate-300',
  running: 'border-blue-500/30 bg-blue-500/15 text-blue-300',
  waiting_permission: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  waiting_human_decision: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  completed: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  aborted: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
  error: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
} as const;

const boardBadgeTone = {
  default: 'border-slate-400/14 bg-slate-400/10 text-slate-300',
  info: 'border-sky-500/30 bg-sky-500/12 text-sky-300',
  success: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300',
  danger: 'border-rose-500/30 bg-rose-500/14 text-rose-200',
} as const;

export default function TaskBoard({
  columns,
  selectedTaskId,
  workspaceLabel,
  onCreateTask,
  onOpenTask,
}: TaskBoardProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-5 rounded-[28px] border border-slate-400/14 bg-[rgba(9,15,25,0.72)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-[16px]">
      <div className="flex flex-col gap-4 rounded-[24px] border border-slate-400/10 bg-slate-950/30 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="m-0 text-xs uppercase tracking-[0.14em] text-slate-500">
            Task board
          </p>
          <p className="m-0 mt-2 text-sm text-slate-400">{workspaceLabel}</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full bg-linear-to-br from-amber-500 to-orange-400 px-4 py-2.5 font-bold text-slate-900 transition duration-150 ease-out hover:-translate-y-px"
          onClick={onCreateTask}
        >
          新しいタスクを作る
        </button>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden px-1 pb-2">
        {columns.map((column) => (
          <section
            key={column.state}
            className="flex min-h-[320px] w-[19rem] min-w-[19rem] shrink-0 flex-col rounded-[24px] border border-slate-400/10 bg-slate-950/35 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.16)]"
          >
            <div
              className={`rounded-[18px] border border-slate-400/10 bg-linear-to-br ${column.accentClassName} px-4 py-3.5`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="m-0 text-sm font-semibold text-slate-100">
                  {column.title}
                </h3>
                <span className="rounded-full border border-slate-400/12 bg-slate-950/35 px-2.5 py-1 text-xs text-slate-300">
                  {column.cards.length}
                </span>
              </div>
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-1">
              {column.cards.length === 0 ? (
                <div className="flex min-h-[140px] items-center justify-center rounded-[18px] border border-dashed border-slate-400/12 bg-slate-950/20 px-4 text-center text-sm text-slate-500">
                  この列のタスクはまだありません
                </div>
              ) : null}

              {column.cards.map((card) => (
                <button
                  key={card.taskId}
                  type="button"
                  className={`rounded-[20px] border px-4 py-4 text-left transition duration-150 ease-out hover:-translate-y-0.5 ${
                    selectedTaskId === card.taskId
                      ? 'border-amber-400/50 bg-[rgba(71,47,13,0.35)] shadow-[0_14px_30px_rgba(245,158,11,0.14)]'
                      : 'border-slate-400/10 bg-slate-900/60 hover:border-slate-300/18 hover:bg-slate-900/80'
                  }`}
                  onClick={() => onOpenTask(card.taskId)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="m-0 text-sm font-semibold leading-6 text-slate-100">
                        {card.title}
                      </h4>
                      <p className="m-0 mt-1 line-clamp-3 text-sm leading-6 text-slate-400">
                        {card.summary}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.7rem] uppercase tracking-[0.08em] ${runtimeTone[card.runtimeState]}`}
                    >
                      {card.runtimeState}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-400/10 px-2.5 py-1 text-slate-300">
                      {card.mode}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 ${boardBadgeTone[card.boardBadgeTone]}`}
                    >
                      {card.mergeFailureLabel ?? card.mergeStatusLabel}
                    </span>
                    <span className="rounded-full bg-slate-400/10 px-2.5 py-1 text-slate-300">
                      {card.workspaceStatusLabel}
                    </span>
                    <span className="rounded-full bg-slate-400/10 px-2.5 py-1 text-slate-300">
                      {formatTime(card.updatedAt)}
                    </span>
                  </div>
                  <p className="m-0 mt-3 text-xs leading-5 text-slate-500">
                    task: {card.taskWorkspacePath}
                  </p>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
