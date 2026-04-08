import { EventEmitter } from 'node:events';
import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
} from 'cline';
import type { ChatRuntimeState } from '../../core/chat.js';
import type { ServiceEvent } from '../../core/clineSessionOrchestratorEvent.js';
import type { AutoCheckResult, TaskLifecycleState } from '../../core/task.js';
import { ClineSessionEventBridge } from './clineSessionEventBridge.js';
import { ClineAgentService } from '../service/ClineAgentService.js';
import { ClineAutoCheckCoordinator } from '../service/ClineAutoCheckCoordinator.js';
import { ClineSessionEventService } from '../service/ClineSessionEventService.js';
import { ClineSessionPromptCoordinator } from '../service/ClineSessionPromptCoordinator.js';
import { ClineTaskLifecycleCoordinator } from '../service/ClineTaskLifecycleCoordinator.js';
import { ClineTaskResumeCoordinator } from '../service/ClineTaskResumeCoordinator.js';
import { ClineTaskRuntimeService } from '../service/ClineTaskRuntimeService.js';
import { ToolCallLogService } from '../service/ToolCallLogService.js';
import { WorkspaceAutoCheckService } from '../service/WorkspaceAutoCheckService.js';

export class ClineSessionOrchestrator {
  private readonly events = new EventEmitter();
  private readonly agentService = new ClineAgentService();
  private readonly runtimeService = new ClineTaskRuntimeService();
  private readonly eventService = new ClineSessionEventService();
  private readonly lifecycleService = new ClineTaskLifecycleCoordinator();
  private readonly resumeService = new ClineTaskResumeCoordinator(
    this.runtimeService,
  );
  private readonly toolCallLogService: ToolCallLogService;
  private readonly workspaceAutoCheckService: WorkspaceAutoCheckService;
  private readonly autoCheckOrchestrationService: ClineAutoCheckCoordinator;
  private readonly promptCoordinator: ClineSessionPromptCoordinator;
  private readonly sessionEventBridge: ClineSessionEventBridge;

  constructor(userDataPath: string) {
    this.toolCallLogService = new ToolCallLogService(userDataPath);
    this.workspaceAutoCheckService = new WorkspaceAutoCheckService(
      userDataPath,
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
    this.sessionEventBridge = new ClineSessionEventBridge(
      this.eventService,
      this.runtimeService,
      this.toolCallLogService,
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

  async startTask(input: { cwd: string; prompt: string }) {
    const response = await this.agentService.newSession({ cwd: input.cwd });
    const session = this.agentService.getSession(response.sessionId);
    this.attachSessionListenersOnce(response.sessionId);
    const task = this.runtimeService.registerTask(session);
    await this.promptCoordinator.ensureSessionMode(task.taskId, 'plan');
    const turn = this.runtimeService.beginTurn(task.taskId);

    this.emit({ type: 'task-created', task });
    this.emit({
      type: 'session-update',
      taskId: task.taskId,
      sessionId: task.sessionId,
      turnId: turn.turnId,
      update: {
        sessionUpdate: 'current_mode_update',
        currentModeId: task.mode,
      },
    });

    this.promptCoordinator.runPrompt({
      taskId: task.taskId,
      sessionId: task.sessionId,
      turnId: turn.turnId,
      prompt: input.prompt,
    });

    return this.runtimeService.getTask(task.taskId);
  }

  async sendMessage(input: { taskId: string; prompt: string }) {
    const task = this.runtimeService.getTask(input.taskId);
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
    ) {
      throw new Error('A turn is already in progress for this session.');
    }

    const turn = this.runtimeService.beginTurn(task.taskId);
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
    await this.agentService.cancel({ sessionId: task.sessionId });
    this.runtimeService.updateRuntimeState(taskId, 'aborted', 'cancelled');
    this.emitRuntimeStateChanged(
      taskId,
      task.sessionId,
      undefined,
      'aborted',
      'cancelled',
    );
  }

  resumeTask(input: {
    taskId: string;
    reason: 'permission' | 'human_decision' | 'resume';
    payload?: {
      approvalId?: string;
      decision?: 'approve' | 'reject';
      requestId?: string;
      value?: unknown;
    };
  }): void {
    const runtimeEvent = this.resumeService.resumeTask(input);
    this.emitRuntimeStateChanged(
      runtimeEvent.taskId,
      runtimeEvent.sessionId,
      runtimeEvent.turnId,
      runtimeEvent.state,
      runtimeEvent.reason,
    );
  }

  transitionTaskLifecycle(input: {
    taskId: string;
    nextState: TaskLifecycleState;
    prompt?: string;
  }): void {
    const task = this.runtimeService.getTask(input.taskId);
    const resolution = this.lifecycleService.resolveHumanTransition(
      task,
      input,
    );

    if (resolution.kind === 'restart') {
      this.promptCoordinator.restartTaskWithPrompt({
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
    this.sessionEventBridge.attachSessionListenersOnce({
      sessionId,
      emitter: this.agentService.emitterForSession(sessionId) as unknown as {
        on: (name: string, listener: (payload: unknown) => void) => void;
      },
      syncTaskModeWithLifecycle: (taskId, mode) => {
        this.promptCoordinator.syncTaskModeWithLifecycle(taskId, mode);
      },
    });
  }

  private handlePermissionRequest(
    request: RequestPermissionRequest,
  ): Promise<RequestPermissionResponse> {
    return new Promise((resolve) => {
      const prepared = this.resumeService.preparePermissionRequest(request);
      if (prepared.kind === 'reject') {
        resolve(prepared.response);
        return;
      }

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
    this.emit({
      type: 'task-lifecycle-state-changed',
      taskId,
      sessionId,
      state,
      mode,
      reason,
      autoCheckResult,
    });
  }

  private emit(event: ServiceEvent): void {
    this.events.emit('event', event);
  }
}
