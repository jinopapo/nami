/* eslint-disable max-lines */
import { EventEmitter } from 'node:events';
import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
} from 'cline';
import type { ChatRuntimeState } from '../../share/chat.js';
import type { ServiceEvent } from '../../share/clineSessionOrchestratorEvent.js';
import type {
  AutoCheckResult,
  TaskLifecycleState,
  TaskReviewMergePolicy,
  UpdateTaskDependenciesInput,
} from '../../share/task.js';
import { ClineAgentService } from '../service/ClineAgentService.js';
import { ClineAutoCheckCoordinator } from '../service/ClineAutoCheckCoordinator.js';
import {
  ClineSessionEventService,
  isToolCallSessionUpdate,
} from '../service/ClineSessionEventService.js';
import { ClineSessionPromptCoordinator } from '../service/ClineSessionPromptCoordinator.js';
import { ClineTaskDependencyCoordinator } from '../service/ClineTaskDependencyCoordinator.js';
import { ClineTaskLifecycleCoordinator } from '../service/ClineTaskLifecycleCoordinator.js';
import { ClineTaskResumeCoordinator } from '../service/ClineTaskResumeCoordinator.js';
import { ClineTaskRuntimeService } from '../service/ClineTaskRuntimeService.js';
import { TaskWorkspaceLifecycleService } from '../service/TaskWorkspaceLifecycleService.js';
import { ToolCallLogService } from '../service/ToolCallLogService.js';
import { toWorkspaceEventPayload } from '../mapper/taskEventMapper.js';
import { TaskWorkspaceService } from '../service/TaskWorkspaceService.js';
import { WorkspaceAutoCheckService } from '../service/WorkspaceAutoCheckService.js';

export class ClineSessionOrchestrator {
  private readonly events = new EventEmitter();
  private readonly planningStartByTask = new Map<string, Promise<void>>();
  private readonly taskWorkspacePreparationByTask = new Map<
    string,
    Promise<void>
  >();
  private readonly agentService = new ClineAgentService();
  private readonly runtimeService = new ClineTaskRuntimeService();
  private readonly eventService = new ClineSessionEventService();
  private readonly lifecycleService = new ClineTaskLifecycleCoordinator();
  private readonly dependencyCoordinator =
    new ClineTaskDependencyCoordinator(this.runtimeService);
  private readonly resumeService = new ClineTaskResumeCoordinator(
    this.runtimeService,
  );
  private readonly toolCallLogService: ToolCallLogService;
  private readonly workspaceAutoCheckService: WorkspaceAutoCheckService;
  private readonly taskWorkspaceService: TaskWorkspaceService;
  private readonly taskWorkspaceLifecycleService: TaskWorkspaceLifecycleService;
  private readonly autoCheckOrchestrationService: ClineAutoCheckCoordinator;
  private readonly promptCoordinator: ClineSessionPromptCoordinator;

  constructor(userDataPath: string) {
    this.toolCallLogService = new ToolCallLogService(userDataPath);
    this.workspaceAutoCheckService = new WorkspaceAutoCheckService(
      userDataPath,
    );
    this.taskWorkspaceService = new TaskWorkspaceService();
    this.taskWorkspaceLifecycleService = new TaskWorkspaceLifecycleService(
      this.runtimeService,
      this.taskWorkspaceService,
    );
    this.autoCheckOrchestrationService = new ClineAutoCheckCoordinator(
      this.runtimeService,
      this.workspaceAutoCheckService,
    );
    this.promptCoordinator = new ClineSessionPromptCoordinator(
      this.agentService,
      this.runtimeService,
      this.lifecycleService,
      this.autoCheckOrchestrationService,
      (event) => this.emit(event),
    );
    this.agentService.setPermissionHandler((request) =>
      this.handlePermissionRequest(request),
    );
  }

  initialize(): Promise<void> {
    return this.agentService.initialize();
  }

  subscribe(listener: (event: ServiceEvent) => void): () => void {
    this.events.on('event', listener);
    return () => this.events.off('event', listener);
  }

  async startTask(input: {
    cwd: string;
    prompt: string;
    taskBranchName?: string;
    reviewMergePolicy?: TaskReviewMergePolicy;
    dependencyTaskIds?: string[];
  }) {
    const taskId = this.runtimeService.createTaskId();
    const workspace = this.taskWorkspaceService.createPendingForTask({
      taskId,
      projectWorkspacePath: input.cwd,
      taskBranchName: input.taskBranchName,
      reviewMergePolicy: input.reviewMergePolicy,
    });
    const dependencyResolution =
      this.dependencyCoordinator.resolveDependenciesForTask({
        taskId,
        dependencyTaskIds: input.dependencyTaskIds,
        reviewMergePolicy: workspace.reviewMergePolicy,
      });
    const response = await this.agentService.newSession({
      cwd: input.cwd,
    });
    const session = this.agentService.getSession(response.sessionId);
    this.attachSessionListenersOnce(response.sessionId);
    const task = this.runtimeService.registerTask(
      session,
      input.prompt,
      workspace,
      taskId,
      dependencyResolution.dependencyTaskIds,
      dependencyResolution.pendingDependencyTaskIds,
    );
    this.emit({ type: 'task-created', task });
    this.emit({
      type: 'session-update',
      taskId: task.taskId,
      sessionId: task.sessionId,
      update: {
        sessionUpdate: 'current_mode_update',
        currentModeId: task.mode,
      },
    });
    if (
      dependencyResolution.dependencyTaskIds.length > 0 &&
      dependencyResolution.pendingDependencyTaskIds.length === 0
    ) {
      void this.dependencyCoordinator.autoStartTaskWhenDependenciesResolved(
        task.taskId,
        this.createDependencyCallbacks(),
      );
    }
    return this.runtimeService.getTask(task.taskId);
  }

  async updateTaskDependencies(
    input: UpdateTaskDependenciesInput,
  ): Promise<void> {
    await this.dependencyCoordinator.updateTaskDependencies(
      input,
      this.createDependencyCallbacks(),
    );
  }

  async sendMessage(input: { taskId: string; prompt: string }) {
    const task = this.runtimeService.getTask(input.taskId);
    if (['waiting_dependencies', 'before_start'].includes(task.lifecycleState))
      throw new Error('Task must start planning before sending messages.');
    const activeTurn = task.activeTurnId
      ? task.turns.find((turn) => turn.turnId === task.activeTurnId)
      : undefined;
    if (
      activeTurn &&
      [
        'submitting',
        'running',
        'waiting_permission',
        'waiting_human_decision',
      ].includes(activeTurn.state)
    )
      throw new Error('A turn is already in progress for this session.');
    const turn = this.runtimeService.beginTurn(task.taskId, input.prompt);
    this.promptCoordinator.runPrompt({
      taskId: task.taskId,
      sessionId: task.sessionId,
      turnId: turn.turnId,
      prompt: input.prompt,
    });
    return {
      taskId: task.taskId,
      sessionId: task.sessionId,
      turnId: turn.turnId,
    };
  }

  async abortTask(taskId: string): Promise<void> {
    const task = this.runtimeService.getTask(taskId);
    if (task.activeTurnId)
      this.runtimeService.completeTurn(
        taskId,
        task.activeTurnId,
        'aborted',
        'cancelled',
      );
    else this.runtimeService.updateRuntimeState(taskId, 'aborted', 'cancelled');
    this.emitRuntimeStateChanged(
      taskId,
      task.sessionId,
      undefined,
      'aborted',
      'cancelled',
    );
    await this.agentService.cancel({ sessionId: task.sessionId });
  }

  async resumeTask(input: {
    taskId: string;
    reason: 'permission' | 'human_decision' | 'resume';
    payload?: {
      approvalId?: string;
      decision?: 'approve' | 'reject';
      requestId?: string;
      value?: unknown;
    };
  }): Promise<void> {
    if (input.reason === 'resume') {
      await this.retryTaskAfterError(input.taskId);
      return;
    }

    const runtimeEvent = this.resumeService.resumeTask(input);
    this.emitRuntimeStateChanged(
      runtimeEvent.taskId,
      runtimeEvent.sessionId,
      runtimeEvent.turnId,
      runtimeEvent.state,
      runtimeEvent.reason,
    );
  }

  async transitionTaskLifecycle(input: {
    taskId: string;
    nextState: TaskLifecycleState;
    prompt?: string;
  }): Promise<void> {
    const task = this.runtimeService.getTask(input.taskId);
    if (
      task.lifecycleState === 'awaiting_review' &&
      input.nextState === 'completed'
    ) {
      let reconcileDependentTasksPromise: Promise<void> | undefined;
      await this.taskWorkspaceLifecycleService.completeTask(
        task.taskId,
        (
          emittedTaskId,
          sessionId,
          state,
          reason,
          mode,
          autoCheckResult,
        ) => {
          this.emitLifecycleStateChanged(
            emittedTaskId,
            sessionId,
            state,
            reason,
            mode,
            autoCheckResult,
          );
          if (state === 'completed') {
            reconcileDependentTasksPromise =
              this.dependencyCoordinator.reconcileDependentTasks(
                emittedTaskId,
                this.createDependencyCallbacks(),
              );
          }
        },
      );
      await reconcileDependentTasksPromise;
      return;
    }
    const resolution = this.lifecycleService.resolveHumanTransition(
      task,
      input,
    );
    if (resolution.kind === 'restart') {
      if (
        task.lifecycleState === 'before_start' &&
        input.nextState === 'planning'
      ) {
        await this.startPlanningFromBeforeStart({
          taskId: input.taskId,
          mode: resolution.mode,
          lifecycleState: resolution.lifecycleState,
          prompt: resolution.prompt,
          reason: resolution.reason,
        });
        return;
      }
      await this.promptCoordinator.restartTaskWithPrompt({
        taskId: input.taskId,
        mode: resolution.mode,
        lifecycleState: resolution.lifecycleState,
        prompt: resolution.prompt,
        reason: resolution.reason,
      });
      return;
    }
    const updatedTask = this.runtimeService.updateLifecycleState(
      input.taskId,
      resolution.lifecycleState,
      resolution.reason,
    );
    this.emitLifecycleStateChanged(
      updatedTask.taskId,
      updatedTask.sessionId,
      updatedTask.lifecycleState,
      resolution.reason,
      updatedTask.mode,
    );
  }

  private attachSessionListenersOnce(sessionId: string): void {
    this.eventService.attachSessionListenersOnce({
      sessionId,
      emitter: this.agentService.emitterForSession(sessionId) as unknown as {
        on: (name: string, listener: (payload: unknown) => void) => void;
      },
      onSessionUpdate: (name, update) => {
        const taskId = this.runtimeService.findTaskIdBySession(sessionId);
        if (!taskId) return;
        if (name === 'current_mode_update') {
          const nextMode = (update as { currentModeId?: unknown })
            .currentModeId;
          if (nextMode === 'plan' || nextMode === 'act')
            this.promptCoordinator.syncTaskModeWithLifecycle(taskId, nextMode);
        }
        if (isToolCallSessionUpdate(update))
          void this.toolCallLogService.log({
            taskId,
            sessionId,
            turnId: this.runtimeService.getTask(taskId).activeTurnId,
            update,
          });
        this.emit({
          type: 'session-update',
          taskId,
          sessionId,
          turnId: this.runtimeService.getTask(taskId).activeTurnId,
          update,
        });
      },
      onError: (error) => {
        const taskId = this.runtimeService.findTaskIdBySession(sessionId);
        if (taskId) {
          this.runtimeService.updateRuntimeState(
            taskId,
            'error',
            error.message,
          );
          this.emitRuntimeStateChanged(
            taskId,
            sessionId,
            this.runtimeService.getTask(taskId).activeTurnId,
            'error',
            error.message,
          );
        }
        this.emit({ type: 'error', taskId, sessionId, message: error.message });
      },
    });
  }

  private handlePermissionRequest(
    request: RequestPermissionRequest,
  ): Promise<RequestPermissionResponse> {
    return new Promise((resolve) => {
      const prepared = this.resumeService.preparePermissionRequest(request);
      if (prepared.kind === 'reject') return resolve(prepared.response);
      this.resumeService.storePermissionRequest(
        prepared.approvalId,
        request,
        prepared.turnId,
        resolve,
      );
      this.emitRuntimeStateChanged(
        prepared.runtimeEvent.taskId,
        prepared.runtimeEvent.sessionId,
        prepared.runtimeEvent.turnId,
        'waiting_permission',
        'permission_requested',
      );
      this.emit({
        type: 'permission-request',
        taskId: prepared.taskId,
        sessionId: prepared.sessionId,
        turnId: prepared.turnId,
        approvalId: prepared.approvalId,
        request,
      });
    });
  }

  private emitRuntimeStateChanged(
    taskId: string,
    sessionId: string,
    turnId: string | undefined,
    state: ChatRuntimeState,
    reason?: string,
  ): void {
    this.emit({
      type: 'chat-runtime-state-changed',
      taskId,
      sessionId,
      turnId,
      state,
      reason,
    });
  }

  private emitLifecycleStateChanged(
    taskId: string,
    sessionId: string,
    state: TaskLifecycleState,
    reason?: string,
    mode?: 'plan' | 'act',
    autoCheckResult?: AutoCheckResult,
  ): void {
    const task = this.runtimeService.getTask(taskId);
    this.emit({
      type: 'task-lifecycle-state-changed',
      taskId,
      sessionId,
      state,
      ...toWorkspaceEventPayload(task),
      mode,
      reason,
      autoCheckResult,
    });
  }

  private emit(event: ServiceEvent): void {
    this.events.emit('event', event);
  }

  private createDependencyCallbacks(): {
    emitLifecycleStateChanged: (
      taskId: string,
      sessionId: string,
      state: TaskLifecycleState,
      reason?: string,
      mode?: 'plan' | 'act',
    ) => void;
    startPlanning: (input: {
      taskId: string;
      mode: 'plan';
      lifecycleState: 'planning';
      prompt: string;
      reason: 'start_planning';
    }) => Promise<void>;
  } {
    return {
      emitLifecycleStateChanged: (taskId, sessionId, state, reason, mode) => {
        this.emitLifecycleStateChanged(taskId, sessionId, state, reason, mode);
      },
      startPlanning: (input) => this.startPlanningFromBeforeStart(input),
    };
  }

  private async retryTaskAfterError(taskId: string): Promise<void> {
    await this.resumeService.retryTask(taskId, (prompt) => {
      void this.promptCoordinator.retryTask({ taskId, prompt });
      return Promise.resolve();
    });
  }

  private startPlanningFromBeforeStart(input: {
    taskId: string;
    mode: 'plan' | 'act';
    lifecycleState: TaskLifecycleState;
    prompt: string;
    reason: string;
  }): Promise<void> {
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

  private async startPlanningFromBeforeStartInternal(input: {
    taskId: string;
    mode: 'plan' | 'act';
    lifecycleState: TaskLifecycleState;
    prompt: string;
    reason: string;
  }): Promise<void> {
    await this.prepareTaskWorkspaceForPlanning(input.taskId);
    const latestTask = this.runtimeService.getTask(input.taskId);
    if (latestTask.lifecycleState !== 'before_start') {
      return;
    }
    await this.promptCoordinator.restartTaskWithPrompt(input);
  }

  private async prepareTaskWorkspaceForPlanning(taskId: string): Promise<void> {
    const task = this.runtimeService.getTask(taskId);
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
    const task = this.runtimeService.getTask(taskId);
    const initializingTask = this.runtimeService.updateTaskWorkspace(taskId, {
      workspaceStatus: 'initializing',
      mergeStatus: 'idle',
      mergeFailureReason: undefined,
      mergeMessage: undefined,
    });
    this.emitLifecycleStateChanged(
      initializingTask.taskId,
      initializingTask.sessionId,
      initializingTask.lifecycleState,
      'task_workspace_initializing',
      initializingTask.mode,
    );
    let workspace:
      | Awaited<ReturnType<TaskWorkspaceService['initializeForTask']>>
      | undefined;
    try {
      workspace = await this.taskWorkspaceService.initializeForTask({
        taskId,
        projectWorkspacePath: task.projectWorkspacePath,
        taskBranchName: task.taskBranchName,
        taskBranchManagement: task.taskBranchManagement,
        reviewMergePolicy: task.reviewMergePolicy,
      });
      const response = await this.agentService.newSession({
        cwd: workspace.taskWorkspacePath,
      });
      const session = this.agentService.getSession(response.sessionId);
      this.attachSessionListenersOnce(response.sessionId);
      this.runtimeService.updateTaskSession(taskId, session);
      const readyTask = this.runtimeService.updateTaskWorkspace(taskId, {
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
      this.emitLifecycleStateChanged(
        readyTask.taskId,
        readyTask.sessionId,
        readyTask.lifecycleState,
        'task_workspace_ready',
        readyTask.mode,
      );
    } catch (error) {
      if (workspace) {
        await this.taskWorkspaceService.cleanupAfterInitializationFailure({
          projectWorkspacePath: workspace.projectWorkspacePath,
          taskWorkspacePath: workspace.taskWorkspacePath,
          taskBranchName: workspace.taskBranchName,
        });
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
    const task = this.runtimeService.getTask(taskId);
    const failedTask = this.runtimeService.updateTaskWorkspace(taskId, {
      cwd: task.projectWorkspacePath,
      taskWorkspacePath: '',
      baseBranchName: '',
      workspaceStatus: 'initialization_failed',
      mergeStatus: 'failed',
      mergeFailureReason: 'command_failed',
      mergeMessage: message,
    });
    this.runtimeService.updateRuntimeState(
      taskId,
      'error',
      'task_workspace_initialization_failed',
    );
    this.emitLifecycleStateChanged(
      failedTask.taskId,
      failedTask.sessionId,
      failedTask.lifecycleState,
      'task_workspace_initialization_failed',
      failedTask.mode,
    );
    this.emitRuntimeStateChanged(
      failedTask.taskId,
      failedTask.sessionId,
      undefined,
      'error',
      'task_workspace_initialization_failed',
    );
    this.emit({
      type: 'error',
      taskId,
      sessionId: failedTask.sessionId,
      message,
    });
  }
}
