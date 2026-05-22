import type { TaskRuntime } from '../entity/clineSession.js';
import type { ClineSdkRuntimeSession } from '../entity/clineSdkConfig.js';

type RestartTaskInput = {
  taskId: string;
  mode: 'plan' | 'act';
  lifecycleState: TaskRuntime['lifecycleState'];
  prompt: string;
  reason: string;
};

type RuntimeServicePort = {
  getTask(taskId: string): TaskRuntime;
  updateTaskWorkspace(
    taskId: string,
    workspace: Partial<
      Pick<
        TaskRuntime,
        | 'cwd'
        | 'projectWorkspacePath'
        | 'taskWorkspacePath'
        | 'taskBranchName'
        | 'taskBranchManagement'
        | 'baseBranchName'
        | 'reviewMergePolicy'
        | 'workspaceStatus'
        | 'mergeStatus'
        | 'mergeFailureReason'
        | 'mergeMessage'
      >
    >,
  ): TaskRuntime;
  updateTaskSession(
    taskId: string,
    session: Pick<ClineSdkRuntimeSession, 'sessionId' | 'mode'>,
  ): TaskRuntime;
  updateRuntimeState(
    taskId: string,
    state: TaskRuntime['runtimeState'],
    reason?: string,
    turnId?: string,
  ): TaskRuntime;
};

type TaskWorkspaceInitializationResult = Pick<
  TaskRuntime,
  | 'projectWorkspacePath'
  | 'taskWorkspacePath'
  | 'taskBranchName'
  | 'taskBranchManagement'
  | 'baseBranchName'
  | 'reviewMergePolicy'
  | 'workspaceStatus'
  | 'mergeStatus'
  | 'mergeFailureReason'
  | 'mergeMessage'
>;

type TaskWorkspaceServicePort = {
  initializeForTask(input: {
    taskId: string;
    projectWorkspacePath: string;
    taskBranchName?: string;
    taskBranchManagement?: TaskRuntime['taskBranchManagement'];
    reviewMergePolicy?: TaskRuntime['reviewMergePolicy'];
  }): Promise<TaskWorkspaceInitializationResult>;
  cleanupAfterInitializationFailure(input: {
    projectWorkspacePath: string;
    taskWorkspacePath: string;
    taskBranchName: string;
  }): Promise<void>;
};

type AgentServicePort = {
  newSession(input: { cwd: string }): Promise<{ sessionId: string }>;
  getSession(sessionId: string): ClineSdkRuntimeSession;
};

export class ClinePlanningWorkspaceCoordinator {
  private readonly planningStartByTask = new Map<string, Promise<void>>();

  private readonly taskWorkspacePreparationByTask = new Map<
    string,
    Promise<void>
  >();

  constructor(
    private readonly ports: {
      runtimeService: RuntimeServicePort;
      taskWorkspaceService: TaskWorkspaceServicePort;
      agentService: AgentServicePort;
      attachSessionListenersOnce: (sessionId: string) => void;
      restartTaskWithPrompt: (input: RestartTaskInput) => Promise<void>;
      emitLifecycleStateChanged: (
        taskId: string,
        sessionId: string,
        state: TaskRuntime['lifecycleState'],
        reason?: string,
        mode?: 'plan' | 'act',
        autoCheckResult?: TaskRuntime['latestAutoCheckResult'],
      ) => void;
      emitRuntimeStateChanged: (
        taskId: string,
        sessionId: string,
        turnId: string | undefined,
        state: TaskRuntime['runtimeState'],
        reason?: string,
      ) => void;
      emitError: (
        taskId: string | undefined,
        sessionId: string | undefined,
        message: string,
      ) => void;
    },
  ) {}

  startPlanningFromBeforeStart(input: RestartTaskInput): Promise<void> {
    const inFlight = this.planningStartByTask.get(input.taskId);
    if (inFlight) {
      return inFlight;
    }
    const promise = this.startPlanningFromBeforeStartInternal(input).finally(
      () => {
        this.planningStartByTask.delete(input.taskId);
      },
    );
    this.planningStartByTask.set(input.taskId, promise);
    return promise;
  }

  private async startPlanningFromBeforeStartInternal(
    input: RestartTaskInput,
  ): Promise<void> {
    await this.prepareTaskWorkspaceForPlanning(input.taskId);
    const latestTask = this.ports.runtimeService.getTask(input.taskId);
    if (latestTask.lifecycleState !== 'before_start') {
      return;
    }
    await this.ports.restartTaskWithPrompt(input);
  }

  private async prepareTaskWorkspaceForPlanning(taskId: string): Promise<void> {
    const task = this.ports.runtimeService.getTask(taskId);
    if (task.workspaceStatus === 'ready' && task.taskWorkspacePath) {
      return;
    }
    const inFlight = this.taskWorkspacePreparationByTask.get(taskId);
    if (inFlight) {
      return inFlight;
    }
    const promise = this.prepareTaskWorkspaceForPlanningInternal(
      taskId,
    ).finally(() => {
      this.taskWorkspacePreparationByTask.delete(taskId);
    });
    this.taskWorkspacePreparationByTask.set(taskId, promise);
    return promise;
  }

  private async prepareTaskWorkspaceForPlanningInternal(
    taskId: string,
  ): Promise<void> {
    const task = this.ports.runtimeService.getTask(taskId);
    const initializingTask = this.ports.runtimeService.updateTaskWorkspace(
      taskId,
      {
        workspaceStatus: 'initializing',
        mergeStatus: 'idle',
        mergeFailureReason: undefined,
        mergeMessage: undefined,
      },
    );
    this.ports.emitLifecycleStateChanged(
      initializingTask.taskId,
      initializingTask.sessionId,
      initializingTask.lifecycleState,
      'task_workspace_initializing',
      initializingTask.mode,
    );
    let workspace: TaskWorkspaceInitializationResult | undefined;
    try {
      workspace = await this.ports.taskWorkspaceService.initializeForTask({
        taskId,
        projectWorkspacePath: task.projectWorkspacePath,
        taskBranchName: task.taskBranchName,
        taskBranchManagement: task.taskBranchManagement,
        reviewMergePolicy: task.reviewMergePolicy,
      });
      const response = await this.ports.agentService.newSession({
        cwd: workspace.taskWorkspacePath,
      });
      const session = this.ports.agentService.getSession(response.sessionId);
      this.ports.attachSessionListenersOnce(response.sessionId);
      this.ports.runtimeService.updateTaskSession(taskId, session);
      const readyTask = this.ports.runtimeService.updateTaskWorkspace(taskId, {
        cwd: workspace.taskWorkspacePath,
        projectWorkspacePath: workspace.projectWorkspacePath,
        taskWorkspacePath: workspace.taskWorkspacePath,
        taskBranchName: workspace.taskBranchName,
        taskBranchManagement: workspace.taskBranchManagement,
        baseBranchName: workspace.baseBranchName,
        reviewMergePolicy: workspace.reviewMergePolicy,
        workspaceStatus: workspace.workspaceStatus,
        mergeStatus: workspace.mergeStatus,
        mergeFailureReason: workspace.mergeFailureReason,
        mergeMessage: workspace.mergeMessage,
      });
      this.ports.emitLifecycleStateChanged(
        readyTask.taskId,
        readyTask.sessionId,
        readyTask.lifecycleState,
        'task_workspace_ready',
        readyTask.mode,
      );
    } catch (error) {
      if (workspace) {
        await this.ports.taskWorkspaceService.cleanupAfterInitializationFailure(
          {
            projectWorkspacePath: workspace.projectWorkspacePath,
            taskWorkspacePath: workspace.taskWorkspacePath,
            taskBranchName: workspace.taskBranchName,
          },
        );
      }
      this.handleTaskWorkspacePreparationFailure(taskId, error);
      throw error;
    }
  }

  private handleTaskWorkspacePreparationFailure(
    taskId: string,
    error: unknown,
  ): void {
    const message = error instanceof Error ? error.message : String(error);
    const task = this.ports.runtimeService.getTask(taskId);
    const failedTask = this.ports.runtimeService.updateTaskWorkspace(taskId, {
      cwd: task.projectWorkspacePath,
      taskWorkspacePath: '',
      baseBranchName: '',
      workspaceStatus: 'initialization_failed',
      mergeStatus: 'failed',
      mergeFailureReason: 'command_failed',
      mergeMessage: message,
    });
    this.ports.runtimeService.updateRuntimeState(
      taskId,
      'error',
      'task_workspace_initialization_failed',
    );
    this.ports.emitLifecycleStateChanged(
      failedTask.taskId,
      failedTask.sessionId,
      failedTask.lifecycleState,
      'task_workspace_initialization_failed',
      failedTask.mode,
    );
    this.ports.emitRuntimeStateChanged(
      failedTask.taskId,
      failedTask.sessionId,
      undefined,
      'error',
      'task_workspace_initialization_failed',
    );
    this.ports.emitError(taskId, failedTask.sessionId, message);
  }
}
