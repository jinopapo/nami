import type { SessionEvent } from '../model/chat';
import type { UiTask } from '../model/task';
import type { TaskLifecycleState } from '../../share/task';

export type TaskBoardColumn = {
  state: TaskLifecycleState;
  title: string;
  accentClassName: string;
};

export type TaskBoardCard = {
  taskId: string;
  title: string;
  summary: string;
  mode: UiTask['mode'];
  runtimeState: UiTask['runtimeState'];
  updatedAt: string;
  pendingDependencyCount: number;
};

const TASK_BOARD_COLUMNS: TaskBoardColumn[] = [
  {
    state: 'waiting_dependencies',
    title: '依存待ち',
    accentClassName: 'from-amber-400/25 to-yellow-300/5',
  },
  {
    state: 'before_start',
    title: '実施前',
    accentClassName: 'from-slate-500/25 to-slate-300/5',
  },
  {
    state: 'planning',
    title: '計画中',
    accentClassName: 'from-sky-500/30 to-cyan-400/10',
  },
  {
    state: 'awaiting_confirmation',
    title: '確認待ち',
    accentClassName: 'from-amber-500/30 to-orange-400/10',
  },
  {
    state: 'executing',
    title: '実行中',
    accentClassName: 'from-violet-500/30 to-fuchsia-400/10',
  },
  {
    state: 'auto_checking',
    title: '自動チェック',
    accentClassName: 'from-indigo-500/30 to-blue-400/10',
  },
  {
    state: 'awaiting_review',
    title: 'レビュー待ち',
    accentClassName: 'from-emerald-500/30 to-green-400/10',
  },
  {
    state: 'completed',
    title: '完了',
    accentClassName: 'from-slate-400/20 to-slate-300/5',
  },
];

const getTaskTitle = (
  task: UiTask,
  events: SessionEvent[] | undefined,
): string => {
  const firstUserMessage = events?.find(
    (event) => event.type === 'userMessage',
  );
  if (firstUserMessage?.type === 'userMessage') {
    return firstUserMessage.text.slice(0, 48) || '新しいタスク';
  }

  return `Task ${task.taskId.slice(0, 8)}`;
};

const getTaskSummary = (events: SessionEvent[] | undefined): string => {
  if (!events || events.length === 0) {
    return 'まだ会話は始まっていません。';
  }

  const latestEvent = [...events]
    .reverse()
    .find(
      (event) =>
        event.type === 'assistantMessageChunk' ||
        event.type === 'userMessage' ||
        event.type === 'toolCall' ||
        event.type === 'permissionRequest' ||
        event.type === 'humanDecisionRequest' ||
        event.type === 'error',
    );

  if (!latestEvent) {
    return '最新のイベントを表示できません。';
  }

  switch (latestEvent.type) {
    case 'assistantMessageChunk':
    case 'userMessage':
      return latestEvent.text.slice(0, 84);
    case 'toolCall':
      return `${latestEvent.title} / ${latestEvent.statusLabel}`;
    case 'permissionRequest':
      return `許可待ち: ${latestEvent.title}`;
    case 'humanDecisionRequest':
      return `判断待ち: ${latestEvent.title}`;
    case 'error':
      return latestEvent.message;
    default:
      return 'イベントを準備中です。';
  }
};

// eslint-disable-next-line no-grouped-exports/no-exported-function-object -- Existing service object; clean up separately.
export const taskBoardService = {
  getColumns: (): TaskBoardColumn[] => TASK_BOARD_COLUMNS,
  getTaskCardsByColumn: (
    tasks: UiTask[],
    sessionsByTask: Record<string, { events: SessionEvent[] }>,
  ) =>
    TASK_BOARD_COLUMNS.map((column) => ({
      ...column,
      cards: tasks
        .filter((task) => task.lifecycleState === column.state)
        .map((task) => {
          return {
            taskId: task.taskId,
            title: getTaskTitle(task, sessionsByTask[task.taskId]?.events),
            summary: getTaskSummary(sessionsByTask[task.taskId]?.events),
            mode: task.mode,
            runtimeState: task.runtimeState,
            updatedAt: task.updatedAt,
            pendingDependencyCount: task.pendingDependencyTaskIds.length,
          };
        }),
    })),
};
