import type { TaskLifecycleState } from '../../core/task';
import type { TaskDetailSummary, UiTask } from '../model/chat';

export type TaskLifecycleAction = {
  key: string;
  label: string;
  nextState: TaskLifecycleState;
  tone?: 'default' | 'primary';
};

const workspaceStatusLabelMap: Record<UiTask['workspaceStatus'], string> = {
  initializing: 'タスクワークスペースを準備中',
  ready: 'タスクワークスペースで作業中',
  merge_pending: 'マージ待ち',
  merged: 'プロジェクトワークスペースへ統合済み',
  merge_failed: 'マージ失敗（要対応）',
};

const mergeStatusLabelMap: Record<UiTask['mergeStatus'], string> = {
  idle: 'マージ待ち',
  running: '再マージ中...',
  succeeded: '統合済み',
  failed: 'マージ失敗',
};

const mergeFailureLabelMap: Record<
  NonNullable<UiTask['mergeFailureReason']>,
  string
> = {
  conflict: 'コンフリクトあり',
  hook_failed: '事前チェック失敗',
  worktrunk_unavailable: 'workTrunk 未導入',
  not_git_repository: 'Git リポジトリではありません',
  command_failed: 'マージコマンド失敗',
  unknown: '不明なエラー',
};

const nextActionMessageMap: Record<
  NonNullable<UiTask['mergeFailureReason']>,
  string
> = {
  conflict:
    'task workspace でコンフリクトを解消してから再度マージしてください。',
  hook_failed: 'pre-merge hook を通るよう修正してから再試行してください。',
  worktrunk_unavailable:
    'workTrunk をインストールしてから再度実行してください。',
  not_git_repository: 'project workspace の Git 設定を確認してください。',
  command_failed: 'ログを確認し、失敗要因を解消してから再試行してください。',
  unknown: '詳細ログを確認し、問題を解消してから再試行してください。',
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

const getTaskDetailSummary = (task?: UiTask): TaskDetailSummary | undefined => {
  if (!task) {
    return undefined;
  }

  return {
    workspaceItems: [
      { label: 'Project workspace', value: task.projectWorkspacePath },
      { label: 'Task workspace', value: task.taskWorkspacePath },
      { label: 'Task branch', value: task.taskBranchName },
      { label: 'Base branch', value: task.baseBranchName },
      {
        label: 'Workspace status',
        value: workspaceStatusLabelMap[task.workspaceStatus],
      },
    ],
    mergeItems: [
      { label: 'Merge status', value: mergeStatusLabelMap[task.mergeStatus] },
      ...(task.mergeFailureReason
        ? [
            {
              label: 'Failure reason',
              value: mergeFailureLabelMap[task.mergeFailureReason],
            },
          ]
        : []),
      ...(task.mergeMessage
        ? [{ label: 'Details', value: task.mergeMessage }]
        : []),
    ],
    nextActionMessage: task.mergeFailureReason
      ? nextActionMessageMap[task.mergeFailureReason]
      : undefined,
  };
};

export const taskLifecycleService = {
  getTaskLifecycleActions,
  getTaskDetailSummary,
};
