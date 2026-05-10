import type {
  AutoCheckFeedbackEvent,
  AutoCheckResult,
  AutoCheckRunSummary,
  AutoCheckStepEvent,
} from './taskAutoCheck.js';
import type { TaskSummary } from './taskSummary.js';
import type {
  TaskBranchManagement,
  TaskLifecycleState,
  TaskMergeFailureReason,
  TaskMergeStatus,
  TaskReviewMergePolicy,
  TaskWorkspaceStatus,
} from './taskState.js';

export type TaskEvent =
  | {
      type: 'taskCreated';
      task: TaskSummary;
      timestamp: string;
    }
  | {
      type: 'taskLifecycleStateChanged';
      taskId: string;
      sessionId: string;
      timestamp: string;
      state: TaskLifecycleState;
      mode?: 'plan' | 'act';
      reason?: string;
      projectWorkspacePath?: string;
      taskWorkspacePath?: string;
      taskBranchName?: string;
      taskBranchManagement?: TaskBranchManagement;
      baseBranchName?: string;
      reviewMergePolicy?: TaskReviewMergePolicy;
      workspaceStatus?: TaskWorkspaceStatus;
      mergeStatus?: TaskMergeStatus;
      mergeFailureReason?: TaskMergeFailureReason;
      mergeMessage?: string;
      dependencyTaskIds?: string[];
      pendingDependencyTaskIds?: string[];
      autoCheckResult?: AutoCheckResult;
    }
  | {
      type: 'autoCheckStarted';
      taskId: string;
      sessionId: string;
      timestamp: string;
      run: AutoCheckRunSummary;
    }
  | {
      type: 'autoCheckStep';
      taskId: string;
      sessionId: string;
      timestamp: string;
      step: AutoCheckStepEvent;
    }
  | {
      type: 'autoCheckCompleted';
      taskId: string;
      sessionId: string;
      timestamp: string;
      result: AutoCheckResult;
      autoCheckRunId: string;
    }
  | {
      type: 'autoCheckFeedbackPrepared';
      taskId: string;
      sessionId: string;
      timestamp: string;
      feedback: AutoCheckFeedbackEvent;
    };
