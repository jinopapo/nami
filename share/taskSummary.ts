import type { ChatEvent } from './chat.js';
import type { AutoCheckResult } from './taskAutoCheck.js';
import type {
  TaskBranchManagement,
  TaskLifecycleState,
  TaskMergeFailureReason,
  TaskMergeStatus,
  TaskReviewMergePolicy,
  TaskWorkspaceStatus,
} from './taskState.js';

type ChatRuntimeState = Extract<
  ChatEvent,
  { type: 'chatRuntimeStateChanged' }
>['state'];

export type TaskSummary = {
  taskId: string;
  sessionId: string;
  cwd: string;
  projectWorkspacePath: string;
  taskWorkspacePath: string;
  taskBranchName: string;
  taskBranchManagement: TaskBranchManagement;
  baseBranchName: string;
  reviewMergePolicy: TaskReviewMergePolicy;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  lifecycleState: TaskLifecycleState;
  runtimeState: ChatRuntimeState;
  workspaceStatus: TaskWorkspaceStatus;
  mergeStatus: TaskMergeStatus;
  mergeFailureReason?: TaskMergeFailureReason;
  mergeMessage?: string;
  dependencyTaskIds: string[];
  pendingDependencyTaskIds: string[];
  latestAutoCheckResult?: AutoCheckResult;
};
