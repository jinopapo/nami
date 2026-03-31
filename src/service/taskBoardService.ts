import type { SessionEvent, UiTask } from '../model/chat';
import type { TaskLifecycleState } from '../../core/task';

export type TaskBoardColumn = {
  state: TaskLifecycleState;
  title: string;
  description: string;
  accentClassName: string;
};

export type TaskBoardCard = {
  taskId: string;
  sessionId: string;
  title: string;
  summary: string;
  mode: UiTask['mode'];
  lifecycleState: UiTask['lifecycleState'];
  runtimeState: UiTask['runtimeState'];
  updatedAt: string;
  cwd: string;
};

const TASK_BOARD_COLUMNS: TaskBoardColumn[] = [
  { state: 'planning', title: '計画中', description: 'planモードでAIが整理中', accentClassName: 'from-sky-500/30 to-cyan-400/10' },
  { state: 'awaiting_confirmation', title: '確認待ち', description: '人間の判断が必要', accentClassName: 'from-amber-500/30 to-orange-400/10' },
  { state: 'executing', title: '実行中', description: 'actモードで進行中', accentClassName: 'from-violet-500/30 to-fuchsia-400/10' },
  { state: 'awaiting_review', title: 'レビュー待ち', description: '成果物の確認待ち', accentClassName: 'from-emerald-500/30 to-green-400/10' },
  { state: 'completed', title: '完了', description: '受け入れ済み', accentClassName: 'from-slate-400/20 to-slate-300/5' },
];

const getTaskTitle = (task: UiTask, events: SessionEvent[] | undefined): string => {
  const firstUserMessage = events?.find((event) => event.type === 'userMessage');
  if (firstUserMessage?.type === 'userMessage') {
    return firstUserMessage.text.slice(0, 48) || '新しいタスク';
  }

  return `Task ${task.taskId.slice(0, 8)}`;
};

const getTaskSummary = (events: SessionEvent[] | undefined): string => {
  if (!events || events.length === 0) {
    return 'まだ会話は始まっていません。';
  }

  const latestEvent = [...events].reverse().find((event) => (
    event.type === 'assistantMessageChunk'
    || event.type === 'userMessage'
    || event.type === 'toolCall'
    || event.type === 'permissionRequest'
    || event.type === 'humanDecisionRequest'
    || event.type === 'error'
  ));

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

export const taskBoardService = {
  getColumns: (): TaskBoardColumn[] => TASK_BOARD_COLUMNS,
  getTaskCardsByColumn: (tasks: UiTask[], sessionsByTask: Record<string, { events: SessionEvent[] }>) => TASK_BOARD_COLUMNS.map((column) => ({
    ...column,
    cards: tasks
      .filter((task) => task.lifecycleState === column.state)
      .map((task) => ({
        taskId: task.taskId,
        sessionId: task.sessionId,
        title: getTaskTitle(task, sessionsByTask[task.taskId]?.events),
        summary: getTaskSummary(sessionsByTask[task.taskId]?.events),
        mode: task.mode,
        lifecycleState: task.lifecycleState,
        runtimeState: task.runtimeState,
        updatedAt: task.updatedAt,
        cwd: task.cwd,
      })),
  })),
};