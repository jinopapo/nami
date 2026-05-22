import { EventEmitter } from 'node:events';
import type { ServiceEvent } from '../../share/clineSessionOrchestratorEvent.js';
import type {
  TaskLifecycleState,
  TaskReviewMergePolicy,
  UpdateTaskDependenciesInput,
} from '../../share/task.js';
import { ClineSdkAgentService } from '../service/ClineSdkAgentService.js';
import { ClineSdkConfigService } from '../service/ClineSdkConfigService.js';
import { ClineAutoCheckCoordinator } from '../service/ClineAutoCheckCoordinator.js';
import { ClinePlanningWorkspaceCoordinator } from '../service/ClinePlanningWorkspaceCoordinator.js';
import { isToolCallSessionUpdate } from '../mapper/ClineSdkSessionEventMapper.js';
import { ClineSessionEventRelayService } from '../service/ClineSessionEventRelayService.js';
import { ClineSessionPromptCoordinator } from '../service/ClineSessionPromptCoordinator.js';
import { ClineTaskDependencyCoordinator } from '../service/ClineTaskDependencyCoordinator.js';
import { ClineTaskLifecycleCoordinator } from '../service/ClineTaskLifecycleCoordinator.js';
import { ClineTaskInteractionCoordinator } from '../service/ClineTaskInteractionCoordinator.js';
import { ClineTaskResumeCoordinator } from '../service/ClineTaskResumeCoordinator.js';
import { ClineTaskRuntimeService } from '../service/ClineTaskRuntimeService.js';
import { ClineTaskStartupCoordinator } from '../service/ClineTaskStartupCoordinator.js';
import { TaskWorkspaceLifecycleService } from '../service/TaskWorkspaceLifecycleService.js';
import { ToolCallLogService } from '../service/ToolCallLogService.js';
import { toWorkspaceEventPayload } from '../mapper/taskEventMapper.js';
import { TaskWorkspaceService } from '../service/TaskWorkspaceService.js';
import { WorkspaceAutoApprovalService } from '../service/WorkspaceAutoApprovalService.js';
import { WorkspaceAutoCheckService } from '../service/WorkspaceAutoCheckService.js';

export class ClineSessionOrchestrator {
  private readonly events = new EventEmitter();
  private readonly agentService: ClineSdkAgentService;
  private readonly runtimeService = new ClineTaskRuntimeService();
  private readonly lifecycleService = new ClineTaskLifecycleCoordinator();
  private readonly dependencyCoordinator = new ClineTaskDependencyCoordinator(
    this.runtimeService,
  );
  private readonly resumeService = new ClineTaskResumeCoordinator(
    this.runtimeService,
  );
  private readonly toolCallLogService: ToolCallLogService;
  private readonly workspaceAutoApprovalService: WorkspaceAutoApprovalService;
  private readonly workspaceAutoCheckService: WorkspaceAutoCheckService;
  private readonly taskWorkspaceService: TaskWorkspaceService;
  private readonly taskWorkspaceLifecycleService: TaskWorkspaceLifecycleService;
  private readonly autoCheckOrchestrationService: ClineAutoCheckCoordinator;
  private readonly promptCoordinator: ClineSessionPromptCoordinator;
  private readonly eventRelay: ClineSessionEventRelayService;
  private readonly interactionCoordinator: ClineTaskInteractionCoordinator;
  private readonly taskStartupCoordinator: ClineTaskStartupCoordinator;
  private readonly planningWorkspaceCoordinator: ClinePlanningWorkspaceCoordinator;

  constructor(userDataPath: string) {
    const clineSdkConfigService = new ClineSdkConfigService(userDataPath);
    this.agentService = new ClineSdkAgentService(clineSdkConfigService);
    this.toolCallLogService = new ToolCallLogService(userDataPath);
    this.workspaceAutoApprovalService = new WorkspaceAutoApprovalService(
      userDataPath,
    );
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
      this.workspaceAutoApprovalService,
      (event) => this.eventRelay.emit(event),
    );
    this.eventRelay = new ClineSessionEventRelayService({
      emit: (event) => this.emit(event as ServiceEvent),
      runtimeService: this.runtimeService,
      agentService: this.agentService,
      syncTaskModeWithLifecycle: (taskId, mode) =>
        this.promptCoordinator.syncTaskModeWithLifecycle(taskId, mode),
      logToolCall: (input) => this.toolCallLogService.log(input),
      isToolCallSessionUpdate,
      toWorkspaceEventPayload,
    });
    this.interactionCoordinator = new ClineTaskInteractionCoordinator({
      runtimeService: this.runtimeService,
      resumeService: this.resumeService,
      runPrompt: (input) => this.promptCoordinator.runPrompt(input),
      retryPrompt: (input) => {
        void this.promptCoordinator.retryTask(input);
      },
      cancelSession: (input) => this.agentService.cancel(input),
      emitRuntimeStateChanged: (...args) =>
        this.eventRelay.emitRuntimeStateChanged(...args),
      emit: (event) => this.eventRelay.emit(event),
    });
    this.taskStartupCoordinator = new ClineTaskStartupCoordinator({
      runtimeService: this.runtimeService,
      taskWorkspaceService: this.taskWorkspaceService,
      dependencyCoordinator: this.dependencyCoordinator,
      agentService: this.agentService,
      attachSessionListenersOnce: (sessionId) =>
        this.eventRelay.attachSessionListenersOnce(sessionId),
      emitTaskCreated: (task) => this.eventRelay.emitTaskCreated(task),
      emitSessionModeUpdate: (taskId, sessionId, mode) =>
        this.eventRelay.emitSessionModeUpdate(taskId, sessionId, mode),
      createDependencyCallbacks: () => this.createDependencyCallbacks(),
    });
    this.planningWorkspaceCoordinator = new ClinePlanningWorkspaceCoordinator({
      runtimeService: this.runtimeService,
      taskWorkspaceService: this.taskWorkspaceService,
      agentService: this.agentService,
      attachSessionListenersOnce: (sessionId) =>
        this.eventRelay.attachSessionListenersOnce(sessionId),
      restartTaskWithPrompt: (input) =>
        this.promptCoordinator.restartTaskWithPrompt(input),
      emitLifecycleStateChanged: (...args) =>
        this.eventRelay.emitLifecycleStateChanged(...args),
      emitRuntimeStateChanged: (...args) =>
        this.eventRelay.emitRuntimeStateChanged(...args),
      emitError: (taskId, sessionId, message) =>
        this.eventRelay.emitError(taskId, sessionId, message),
    });
    this.agentService.setPermissionHandler((request) =>
      this.interactionCoordinator.handlePermissionRequest(request),
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
    return this.taskStartupCoordinator.startTask(input);
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
    return this.interactionCoordinator.sendMessage(input);
  }

  async abortTask(taskId: string): Promise<void> {
    await this.interactionCoordinator.abortTask(taskId);
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
    await this.interactionCoordinator.resumeTask(input);
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
        (emittedTaskId, sessionId, state, reason, mode, autoCheckResult) => {
          this.eventRelay.emitLifecycleStateChanged(
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
        await this.planningWorkspaceCoordinator.startPlanningFromBeforeStart({
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
    this.eventRelay.emitLifecycleStateChanged(
      updatedTask.taskId,
      updatedTask.sessionId,
      updatedTask.lifecycleState,
      resolution.reason,
      updatedTask.mode,
    );
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
        this.eventRelay.emitLifecycleStateChanged(
          taskId,
          sessionId,
          state,
          reason,
          mode,
        );
      },
      startPlanning: (input) =>
        this.planningWorkspaceCoordinator.startPlanningFromBeforeStart(input),
    };
  }

  private emit(event: ServiceEvent): void {
    this.events.emit('event', event);
  }
}
