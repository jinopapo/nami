/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_entity'. Dependency is of type 'share' */
import type {
  TaskMergeFailureReason,
  TaskMergeStatus,
  TaskWorkspaceStatus,
} from '../../share/task.js';

export type TaskWorkspaceContext = {
  projectWorkspacePath: string;
  taskWorkspacePath: string;
  taskBranchName: string;
  baseBranchName: string;
  shouldMergeAfterReview: boolean;
  workspaceStatus: TaskWorkspaceStatus;
  mergeStatus: TaskMergeStatus;
  mergeFailureReason?: TaskMergeFailureReason;
  mergeMessage?: string;
};

export type PendingTaskWorkspaceContext = Omit<
  TaskWorkspaceContext,
  'workspaceStatus'
> & {
  workspaceStatus: 'initializing';
};

export type TaskWorkspaceMergeResult = Pick<
  TaskWorkspaceContext,
  'workspaceStatus' | 'mergeStatus' | 'mergeFailureReason' | 'mergeMessage'
>;
