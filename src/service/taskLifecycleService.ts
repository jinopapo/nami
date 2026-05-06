import type { TaskLifecycleState } from '../../share/task';
import type { SessionStatus } from '../model/chat';
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

const ABORTED_RESUME_ACTION: TaskLifecycleAction = {
  key: 'resume-aborted',
  label: '再開する',
  nextState: 'executing',
  tone: 'primary',
};

const isRetryableErrorTask = (task: UiTask): boolean =>
  task.runtimeState === 'error' &&
  ['planning', 'executing'].includes(task.lifecycleState);

const isResumableAbortedTask = (task: UiTask): boolean =>
  task.runtimeState === 'aborted' &&
  ['planning', 'executing'].includes(task.lifecycleState);

const ACTIONS_BY_STATE: Record<TaskLifecycleState, TaskLifecycleAction[]> = {
  waiting_dependencies: [],
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

  if (isResumableAbortedTask(task)) {
    return [
      {
        ...ABORTED_RESUME_ACTION,
        nextState: task.lifecycleState,
      },
    ];
  }

  return ACTIONS_BY_STATE[task.lifecycleState];
};

const getLifecycleActionPresentation = (
  statusPhase: SessionStatus['phase'],
  actions: TaskLifecycleAction[],
) => {
  const retryAction = actions.find((action) =>
    ['retry-error', 'resume-aborted'].includes(action.key),
  );
  const nonRetryActions = actions.filter(
    (action) => !['retry-error', 'resume-aborted'].includes(action.key),
  );
  const shouldShowDecisionActions =
    statusPhase === 'before_start' || statusPhase === 'awaiting_confirmation';

  return {
    retryAction,
    drawerActions: shouldShowDecisionActions ? [] : nonRetryActions,
    composerDecisionActions: shouldShowDecisionActions ? nonRetryActions : [],
  };
};

// eslint-disable-next-line no-grouped-exports/no-exported-function-object -- Existing service object; clean up separately.
export const taskLifecycleService = {
  getTaskLifecycleActions,
  getLifecycleActionPresentation,
};
