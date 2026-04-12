import type { TaskLifecycleState } from '../../share/task';
import type { UiTask } from '../model/chat';

export type TaskLifecycleAction = {
  key: string;
  label: string;
  nextState: TaskLifecycleState;
  tone?: 'default' | 'primary';
};

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

  return ACTIONS_BY_STATE[task.lifecycleState];
};

export const taskLifecycleService = {
  getTaskLifecycleActions,
};
