import type { TaskLifecycleState } from '../../core/task';
import type { UiTask } from '../model/chat';

export type TaskLifecycleAction = {
  key: string;
  label: string;
  nextState: TaskLifecycleState;
  tone?: 'default' | 'primary';
};

const ACTIONS_BY_STATE: Record<TaskLifecycleState, TaskLifecycleAction[]> = {
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
  awaiting_review: [
    {
      key: 'complete-task',
      label: '完了にする',
      nextState: 'completed',
      tone: 'primary',
    },
  ],
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
