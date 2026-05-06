import type { TaskRuntime } from '../entity/clineSession.js';
import type { TaskWorkspaceMergeResult } from '../entity/taskWorkspace.js';

type TaskLifecycleState = TaskRuntime['lifecycleState'];

type TaskMode = TaskRuntime['mode'];

type LatestAutoCheckResult = TaskRuntime['latestAutoCheckResult'];

type ReviewMergePolicy = TaskRuntime['reviewMergePolicy'];

const canMergeAfterReview = (reviewMergePolicy: ReviewMergePolicy): boolean =>
  reviewMergePolicy === 'merge_to_base';

type LifecycleEmitter = (
  taskId: string,
  sessionId: string,
  state: TaskLifecycleState,
  reason?: string,
  mode?: TaskMode,
  autoCheckResult?: LatestAutoCheckResult,
) => void;

type RuntimeServicePort = {
  getTask(taskId: string): TaskRuntime;
  updateLifecycleState(
    taskId: string,
    state: TaskLifecycleState,
    reason?: string,
    autoCheckResult?: LatestAutoCheckResult,
  ): TaskRuntime;
  updateTaskWorkspace(
    taskId: string,
    workspace: TaskWorkspaceMergeResult,
  ): TaskRuntime;
};

type TaskWorkspaceServicePort = {
  mergeToProjectWorkspace(input: {
    taskWorkspacePath: string;
    baseBranchName: string;
  }): Promise<TaskWorkspaceMergeResult>;
};

export class TaskWorkspaceLifecycleService {
  constructor(
    private readonly runtimeService: RuntimeServicePort,
    private readonly taskWorkspaceService: TaskWorkspaceServicePort,
  ) {}

  async completeTask(
    taskId: string,
    emitLifecycleStateChanged: LifecycleEmitter,
  ): Promise<void> {
    const task = this.runtimeService.getTask(taskId);
    if (!canMergeAfterReview(task.reviewMergePolicy)) {
      this.runtimeService.updateTaskWorkspace(taskId, {
        workspaceStatus: 'merge_skipped',
        mergeStatus: 'idle',
        mergeFailureReason: undefined,
        mergeMessage: undefined,
      });
      const completedTask = this.runtimeService.updateLifecycleState(
        taskId,
        'completed',
        'merge_skipped',
      );
      emitLifecycleStateChanged(
        completedTask.taskId,
        completedTask.sessionId,
        completedTask.lifecycleState,
        'merge_skipped',
        completedTask.mode,
      );
      return;
    }

    const runningTask = this.runtimeService.updateTaskWorkspace(taskId, {
      workspaceStatus: 'merge_pending',
      mergeStatus: 'running',
      mergeFailureReason: undefined,
      mergeMessage: undefined,
    });
    emitLifecycleStateChanged(
      runningTask.taskId,
      runningTask.sessionId,
      runningTask.lifecycleState,
      'merge_started',
      runningTask.mode,
    );

    const mergeResult = await this.taskWorkspaceService.mergeToProjectWorkspace(
      {
        taskWorkspacePath: runningTask.taskWorkspacePath,
        baseBranchName: runningTask.baseBranchName,
      },
    );

    const mergedTask = this.runtimeService.updateTaskWorkspace(
      taskId,
      mergeResult,
    );
    if (mergeResult.mergeStatus === 'succeeded') {
      const completedTask = this.runtimeService.updateLifecycleState(
        taskId,
        'completed',
        'merge_succeeded',
      );
      emitLifecycleStateChanged(
        completedTask.taskId,
        completedTask.sessionId,
        completedTask.lifecycleState,
        'merge_succeeded',
        completedTask.mode,
      );
      return;
    }

    emitLifecycleStateChanged(
      mergedTask.taskId,
      mergedTask.sessionId,
      mergedTask.lifecycleState,
      'merge_failed',
      mergedTask.mode,
    );
  }
}
