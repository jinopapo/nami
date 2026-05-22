import type { TaskRuntime } from '../entity/clineSession.js';
import type { ClineSdkRuntimeSession } from '../entity/clineSdkConfig.js';

type DependencyResolution = {
  dependencyTaskIds: string[];
  pendingDependencyTaskIds: string[];
};

type DependencyCallbacks = {
  emitLifecycleStateChanged: (
    taskId: string,
    sessionId: string,
    state: TaskRuntime['lifecycleState'],
    reason?: string,
    mode?: TaskRuntime['mode'],
  ) => void;
  startPlanning: (input: {
    taskId: string;
    mode: 'plan';
    lifecycleState: 'planning';
    prompt: string;
    reason: 'start_planning';
  }) => Promise<void>;
};

type RuntimeServicePort = {
  createTaskId(): string;
  registerTask(
    session: ClineSdkRuntimeSession,
    initialPrompt: string,
    workspace: Pick<
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
    >,
    taskId?: string,
    dependencyTaskIds?: string[],
    pendingDependencyTaskIds?: string[],
  ): TaskRuntime;
  getTask(taskId: string): TaskRuntime;
};

type TaskWorkspaceServicePort = {
  createPendingForTask(input: {
    taskId: string;
    projectWorkspacePath: string;
    taskBranchName?: string;
    reviewMergePolicy?: TaskRuntime['reviewMergePolicy'];
  }): Pick<
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
};

type DependencyCoordinatorPort = {
  resolveDependenciesForTask(input: {
    taskId: string;
    dependencyTaskIds: string[] | undefined;
    reviewMergePolicy: TaskRuntime['reviewMergePolicy'];
  }): DependencyResolution;
  autoStartTaskWhenDependenciesResolved(
    taskId: string,
    callbacks: DependencyCallbacks,
  ): Promise<void>;
};

type AgentServicePort = {
  newSession(input: { cwd: string }): Promise<{ sessionId: string }>;
  getSession(sessionId: string): ClineSdkRuntimeSession;
};

export class ClineTaskStartupCoordinator {
  constructor(
    private readonly ports: {
      runtimeService: RuntimeServicePort;
      taskWorkspaceService: TaskWorkspaceServicePort;
      dependencyCoordinator: DependencyCoordinatorPort;
      agentService: AgentServicePort;
      attachSessionListenersOnce: (sessionId: string) => void;
      emitTaskCreated: (task: TaskRuntime) => void;
      emitSessionModeUpdate: (
        taskId: string,
        sessionId: string,
        mode: 'plan' | 'act',
      ) => void;
      createDependencyCallbacks: () => DependencyCallbacks;
    },
  ) {}

  async startTask(input: {
    cwd: string;
    prompt: string;
    taskBranchName?: string;
    reviewMergePolicy?: TaskRuntime['reviewMergePolicy'];
    dependencyTaskIds?: string[];
  }): Promise<TaskRuntime> {
    const taskId = this.ports.runtimeService.createTaskId();
    const workspace = this.ports.taskWorkspaceService.createPendingForTask({
      taskId,
      projectWorkspacePath: input.cwd,
      taskBranchName: input.taskBranchName,
      reviewMergePolicy: input.reviewMergePolicy,
    });
    const dependencyResolution =
      this.ports.dependencyCoordinator.resolveDependenciesForTask({
        taskId,
        dependencyTaskIds: input.dependencyTaskIds,
        reviewMergePolicy: workspace.reviewMergePolicy,
      });
    const response = await this.ports.agentService.newSession({
      cwd: input.cwd,
    });
    const session = this.ports.agentService.getSession(response.sessionId);
    this.ports.attachSessionListenersOnce(response.sessionId);
    const task = this.ports.runtimeService.registerTask(
      session,
      input.prompt,
      workspace,
      taskId,
      dependencyResolution.dependencyTaskIds,
      dependencyResolution.pendingDependencyTaskIds,
    );
    this.ports.emitTaskCreated(task);
    this.ports.emitSessionModeUpdate(task.taskId, task.sessionId, task.mode);
    if (
      dependencyResolution.dependencyTaskIds.length > 0 &&
      dependencyResolution.pendingDependencyTaskIds.length === 0
    ) {
      void this.ports.dependencyCoordinator.autoStartTaskWhenDependenciesResolved(
        task.taskId,
        this.ports.createDependencyCallbacks(),
      );
    }
    return this.ports.runtimeService.getTask(task.taskId);
  }
}
