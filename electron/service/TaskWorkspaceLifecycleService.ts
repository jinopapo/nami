/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'share' */
import type { AutoCheckResult, TaskLifecycleState } from '../../share/task.js';
import type { TaskRuntime } from '../entity/clineSession.js';

type LifecycleEmitter = (
  taskId: string,
  sessionId: string,
  state: TaskLifecycleState,
  reason?: string,
  mode?: 'plan' | 'act',
  autoCheckResult?: AutoCheckResult,
) => void;

type RuntimeServicePort = {
  getTask(taskId: string): TaskRuntime;
  updateLifecycleState(
    taskId: string,
    state: TaskLifecycleState,
    reason?: string,
    autoCheckResult?: AutoCheckResult,
  ): TaskRuntime;
  updateTaskWorkspace(
    taskId: string,
    workspace: Partial<
      Pick<
        TaskRuntime,
        | 'cwd'
        | 'projectWorkspacePath'
        | 'taskWorkspacePath'
        | 'taskBranchName'
        | 'baseBranchName'
        | 'workspaceStatus'
        | 'mergeStatus'
        | 'mergeFailureReason'
        | 'mergeMessage'
      >
    >,
  ): TaskRuntime;
};

type TaskWorkspaceServicePort = {
  mergeToProjectWorkspace(input: {
    taskWorkspacePath: string;
    baseBranchName: string;
  }): Promise<
    Partial<
      Pick<
        TaskRuntime,
        | 'workspaceStatus'
        | 'mergeStatus'
        | 'mergeFailureReason'
        | 'mergeMessage'
      >
    >
  >;
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
