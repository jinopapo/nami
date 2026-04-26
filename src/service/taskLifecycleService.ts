import type { TaskLifecycleState } from '../../share/task';
import type { UiTask } from '../model/task';

export type TaskLifecycleAction = {
  key: string;
  label: string;
  nextState: TaskLifecycleState;
  tone?: 'default' | 'primary';
};

const ERROR_RETRY_ACTION: TaskLifecycleAction = {
  key: 'retry-error',
  label: '再試行する',
  nextState: 'executing',
  tone: 'primary',
};

const isRetryableErrorTask = (task: UiTask): boolean =>
  task.runtimeState === 'error' &&
  ['planning', 'executing'].includes(task.lifecycleState);

const ACTIONS_BY_STATE: Record<TaskLifecycleState, TaskLifecycleAction[]> = {
  before_start: [
    {
      key: 'start-planning',
      label: '計画を開始する',
      nextState: 'planning',
      tone: 'primary',
    },
  ],
  planning: [],
  awaiting_confirmation: [
    { key: 'rework-plan', label: '計画を練り直す', nextState: 'planning' },
    {
      key: 'start-executing',
      label: '実行に移す',
      nextState: 'executing',
      tone: 'primary',
    },
  ],
  executing: [],
  auto_checking: [],
  awaiting_review: [],
  completed: [],
};

const getTaskLifecycleActions = (task?: UiTask): TaskLifecycleAction[] => {
  if (!task) {
    return [];
  }

  if (isRetryableErrorTask(task)) {
    return [
      {
        ...ERROR_RETRY_ACTION,
        nextState: task.lifecycleState,
      },
    ];
  }

  return ACTIONS_BY_STATE[task.lifecycleState];
};

export const taskLifecycleService = {
  getTaskLifecycleActions,
};
