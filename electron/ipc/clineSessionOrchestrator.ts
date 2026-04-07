import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionUpdate,
} from 'cline';
import type { ChatRuntimeState } from '../../core/chat.js';
import type {
  AutoCheckFeedbackEvent,
  AutoCheckResult,
  AutoCheckRunSummary,
  AutoCheckStepEvent,
  AutoCheckStepResult,
  TaskLifecycleState,
} from '../../core/task.js';
import { ClineAgentService } from '../service/ClineAgentService.js';
import {
  ClineSessionEventService,
  type ToolCallSessionUpdate,
} from '../service/ClineSessionEventService.js';
import { ClineTaskRuntimeService } from '../service/ClineTaskRuntimeService.js';
import { ToolCallLogService } from '../service/ToolCallLogService.js';
import { WorkspaceAutoCheckService } from '../service/WorkspaceAutoCheckService.js';

type TaskRecordSnapshot = {
  taskId: string;
  sessionId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  lifecycleState: TaskLifecycleState;
  runtimeState: ChatRuntimeState;
  latestAutoCheckResult?: AutoCheckResult;
};

type ServiceEvent =
  | { type: 'task-created'; task: TaskRecordSnapshot }
  | {
      type: 'task-lifecycle-state-changed';
      taskId: string;
      sessionId: string;
      state: TaskLifecycleState;
      mode?: 'plan' | 'act';
      reason?: string;
      autoCheckResult?: AutoCheckResult;
    }
  | {
      type: 'auto-check-started';
      taskId: string;
      sessionId: string;
      run: AutoCheckRunSummary;
    }
  | {
      type: 'auto-check-step';
      taskId: string;
      sessionId: string;
      step: AutoCheckStepEvent;
    }
  | {
      type: 'auto-check-completed';
      taskId: string;
      sessionId: string;
      autoCheckRunId: string;
      result: AutoCheckResult;
    }
  | {
      type: 'auto-check-feedback-prepared';
      taskId: string;
      sessionId: string;
      feedback: AutoCheckFeedbackEvent;
    }
  | {
      type: 'session-update';
      taskId: string;
      sessionId: string;
      turnId?: string;
      update: SessionUpdate;
    }
  | {
      type: 'permission-request';
      taskId: string;
      sessionId: string;
      turnId: string;
      approvalId: string;
      request: RequestPermissionRequest;
    }
  | {
      type: 'human-decision-request';
      taskId: string;
      sessionId: string;
      turnId: string;
      requestId: string;
      title: string;
      description?: string;
      schema?: unknown;
    }
  | {
      type: 'assistant-message-completed';
      taskId: string;
      sessionId: string;
      turnId: string;
      reason?: string;
    }
  | {
      type: 'chat-runtime-state-changed';
      taskId: string;
      sessionId: string;
      turnId?: string;
      state: ChatRuntimeState;
      reason?: string;
    }
  | { type: 'error'; taskId?: string; sessionId?: string; message: string };

const EXECUTION_START_PROMPT =
  'これまでの計画を踏まえて、actモードとして実行を開始してください。';
const AUTO_CHECK_FAILURE_PROMPT =
  '自動チェックに失敗しました。失敗したチェック結果だけを確認して修正してください。';

const buildAutoCheckFailureFeedback = (
  failedStep: AutoCheckStepResult,
): AutoCheckFeedbackEvent => {
  const stdoutSection = failedStep.stderr.trim()
    ? ''
    : `\nstdout:\n${failedStep.stdout || '(empty)'}`;
  const prompt = `${AUTO_CHECK_FAILURE_PROMPT}\n\nstep: ${failedStep.name}\ncommand: ${failedStep.command}\nexitCode: ${failedStep.exitCode}\nstderr:\n${failedStep.stderr || '(empty)'}${stdoutSection}`;

  return {
    autoCheckRunId: 'unknown',
    stepId: failedStep.stepId,
    name: failedStep.name,
    command: failedStep.command,
    exitCode: failedStep.exitCode,
    stdout: failedStep.stdout,
    stderr: failedStep.stderr,
    prompt,
  };
};

const isPlanningCompletionStopReason = (stopReason?: string): boolean =>
  ['end_turn', 'completed'].includes(stopReason ?? '');
const isExecutionCompletionStopReason = (stopReason?: string): boolean =>
  ['end_turn', 'completed'].includes(stopReason ?? '');

export class ClineSessionOrchestrator {
  private readonly events = new EventEmitter();
  private readonly agentService = new ClineAgentService();
  private readonly runtimeService = new ClineTaskRuntimeService();
  private readonly eventService = new ClineSessionEventService();
  private readonly toolCallLogService: ToolCallLogService;
  private readonly workspaceAutoCheckService: WorkspaceAutoCheckService;

  constructor(userDataPath: string) {
    this.toolCallLogService = new ToolCallLogService(userDataPath);
    this.workspaceAutoCheckService = new WorkspaceAutoCheckService(
      userDataPath,
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
    await this.ensureSessionMode(task.taskId, 'plan');
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

    this.runPrompt({
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
    this.runPrompt({
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
    const task = this.runtimeService.getTask(input.taskId);

    if (input.reason === 'permission') {
      const approvalId = input.payload?.approvalId;
      const decision = input.payload?.decision;

      if (!approvalId || !decision) {
        throw new Error(
          'approvalId and decision are required for permission resumes',
        );
      }

      const pending = this.runtimeService.takeApproval(approvalId);
      pending.resolve({
        outcome: {
          outcome: 'selected',
          optionId: decision === 'approve' ? 'allow_once' : 'reject_once',
        },
      });
      this.runtimeService.updateRuntimeState(
        input.taskId,
        'running',
        'permission_resolved',
        pending.turnId,
      );
      this.emitRuntimeStateChanged(
        input.taskId,
        task.sessionId,
        pending.turnId,
        'running',
        'permission_resolved',
      );
      return;
    }

    if (input.reason === 'human_decision') {
      const pendingHumanDecision = task.pendingHumanDecision;
      if (!pendingHumanDecision) {
        throw new Error(`Human decision not found for task: ${input.taskId}`);
      }
      if (input.payload?.requestId !== pendingHumanDecision.requestId) {
        throw new Error(
          `Human decision request mismatch: ${input.payload?.requestId ?? 'unknown'}`,
        );
      }

      pendingHumanDecision.resolve(input.payload?.value);
      this.runtimeService.clearPendingHumanDecision(input.taskId);
      this.runtimeService.updateRuntimeState(
        input.taskId,
        'running',
        input.reason,
        pendingHumanDecision.turnId,
      );
      this.emitRuntimeStateChanged(
        input.taskId,
        task.sessionId,
        pendingHumanDecision.turnId,
        'running',
        input.reason,
      );
      return;
    }

    this.runtimeService.updateRuntimeState(
      input.taskId,
      'running',
      input.reason,
      task.activeTurnId,
    );
    this.emitRuntimeStateChanged(
      input.taskId,
      task.sessionId,
      task.activeTurnId,
      'running',
      input.reason,
    );
  }

  transitionTaskLifecycle(input: {
    taskId: string;
    nextState: TaskLifecycleState;
    prompt?: string;
  }): void {
    const task = this.runtimeService.getTask(input.taskId);
    const transitions: Record<TaskLifecycleState, TaskLifecycleState[]> = {
      planning: ['awaiting_confirmation'],
      awaiting_confirmation: ['planning', 'executing'],
      executing: ['auto_checking', 'awaiting_review'],
      auto_checking: ['executing', 'awaiting_review'],
      awaiting_review: ['completed'],
      completed: [],
    };
    const allowed = transitions[task.lifecycleState] ?? [];
    if (!allowed.includes(input.nextState)) {
      throw new Error(
        `Invalid lifecycle transition: ${task.lifecycleState} -> ${input.nextState}`,
      );
    }

    if (
      task.lifecycleState === 'awaiting_confirmation' &&
      input.nextState === 'planning'
    ) {
      const prompt = input.prompt?.trim();
      if (!prompt) {
        throw new Error('Prompt is required when restarting planning.');
      }

      this.restartTaskWithPrompt({
        taskId: input.taskId,
        mode: 'plan',
        lifecycleState: 'planning',
        prompt,
        reason: 'retry_planning',
      });
      return;
    }

    if (
      task.lifecycleState === 'awaiting_confirmation' &&
      input.nextState === 'executing'
    ) {
      this.restartTaskWithPrompt({
        taskId: input.taskId,
        mode: 'act',
        lifecycleState: 'executing',
        prompt: EXECUTION_START_PROMPT,
        reason: 'start_execution',
      });
      return;
    }

    const updatedTask = this.runtimeService.updateLifecycleState(
      input.taskId,
      input.nextState,
      'human_transition',
    );
    this.emitLifecycleStateChanged(
      updatedTask.taskId,
      updatedTask.sessionId,
      updatedTask.lifecycleState,
      'human_transition',
      updatedTask.mode,
    );
  }

  private runPrompt(input: {
    taskId: string;
    sessionId: string;
    turnId: string;
    prompt: string;
  }): void {
    this.runtimeService.updateRuntimeState(
      input.taskId,
      'running',
      'prompt_started',
      input.turnId,
    );
    this.emitRuntimeStateChanged(
      input.taskId,
      input.sessionId,
      input.turnId,
      'running',
      'prompt_started',
    );

    void this.agentService
      .prompt({
        sessionId: input.sessionId,
        prompt: input.prompt,
      })
      .then((promptResponse) => {
        this.runtimeService.completeTurn(
          input.taskId,
          input.turnId,
          promptResponse.stopReason === 'cancelled' ? 'aborted' : 'completed',
          promptResponse.stopReason,
        );
        this.emit({
          type: 'assistant-message-completed',
          taskId: input.taskId,
          sessionId: input.sessionId,
          turnId: input.turnId,
          reason: promptResponse.stopReason,
        });
        this.syncLifecycleAfterPrompt(input.taskId, promptResponse.stopReason);
      })
      .catch((error: unknown) => {
        this.runtimeService.completeTurn(
          input.taskId,
          input.turnId,
          'error',
          error instanceof Error ? error.message : 'Unknown error',
        );
        this.emit({
          type: 'error',
          taskId: input.taskId,
          sessionId: input.sessionId,
          message:
            error instanceof Error ? error.message : 'Failed to execute task',
        });
      });
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
          if (nextMode === 'plan' || nextMode === 'act') {
            this.syncTaskModeWithLifecycle(taskId, nextMode);
          }
        }

        if (name === 'tool_call' || name === 'tool_call_update') {
          void this.toolCallLogService.log({
            taskId,
            sessionId,
            turnId: this.runtimeService.getTask(taskId).activeTurnId,
            update: update as ToolCallSessionUpdate,
          });
        }

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
        }
        this.emit({ type: 'error', taskId, sessionId, message: error.message });
      },
    });
  }

  private handlePermissionRequest(
    request: RequestPermissionRequest,
  ): Promise<RequestPermissionResponse> {
    return new Promise((resolve) => {
      const taskId = this.runtimeService.findTaskIdBySession(request.sessionId);
      if (!taskId) {
        resolve({ outcome: { outcome: 'selected', optionId: 'reject_once' } });
        return;
      }

      const task = this.runtimeService.getTask(taskId);
      const turnId = task.activeTurnId;
      if (!turnId) {
        resolve({ outcome: { outcome: 'selected', optionId: 'reject_once' } });
        return;
      }

      const approvalId = randomUUID();
      this.runtimeService.storeApproval(approvalId, {
        taskId,
        sessionId: request.sessionId,
        turnId,
        resolve,
      });
      this.runtimeService.updateRuntimeState(
        taskId,
        'waiting_permission',
        'permission_requested',
        turnId,
      );
      this.emitRuntimeStateChanged(
        taskId,
        request.sessionId,
        turnId,
        'waiting_permission',
        'permission_requested',
      );
      this.emit({
        type: 'permission-request',
        taskId,
        sessionId: request.sessionId,
        turnId,
        approvalId,
        request,
      });
    });
  }

  private async ensureSessionMode(
    taskId: string,
    mode: 'plan' | 'act',
  ): Promise<void> {
    const task = this.runtimeService.getTask(taskId);
    const sessionMode = this.agentService.getSession(task.sessionId).mode;
    const effectiveMode =
      sessionMode === 'plan' || sessionMode === 'act' ? sessionMode : task.mode;

    if (effectiveMode === mode) {
      if (task.mode !== mode) {
        this.runtimeService.updateTaskMode(taskId, mode);
      }
      return;
    }

    await this.agentService.setSessionMode({
      sessionId: task.sessionId,
      modeId: mode,
    });
    this.runtimeService.updateTaskMode(taskId, mode);
  }

  private syncTaskModeWithLifecycle(
    taskId: string,
    mode: 'plan' | 'act',
  ): void {
    const task = this.runtimeService.getTask(taskId);
    const expectedMode = this.runtimeService.expectedModeFor(taskId);
    if (expectedMode && mode !== expectedMode) {
      void this.ensureSessionMode(taskId, expectedMode).catch(
        (error: unknown) => {
          this.emit({
            type: 'error',
            taskId,
            sessionId: task.sessionId,
            message:
              error instanceof Error
                ? error.message
                : 'Failed to restore expected session mode',
          });
        },
      );
      return;
    }

    this.runtimeService.updateTaskMode(taskId, mode);
  }

  private restartTaskWithPrompt(input: {
    taskId: string;
    mode: 'plan' | 'act';
    lifecycleState: TaskLifecycleState;
    prompt: string;
    reason: string;
  }): void {
    void this.restartTaskWithPromptInternal(input);
  }

  private async restartTaskWithPromptInternal(input: {
    taskId: string;
    mode: 'plan' | 'act';
    lifecycleState: TaskLifecycleState;
    prompt: string;
    reason: string;
  }): Promise<void> {
    const task = this.runtimeService.getTask(input.taskId);
    await this.ensureSessionMode(input.taskId, input.mode);
    const updatedTask = this.runtimeService.updateLifecycleState(
      input.taskId,
      input.lifecycleState,
      input.reason,
    );
    this.emitLifecycleStateChanged(
      updatedTask.taskId,
      updatedTask.sessionId,
      updatedTask.lifecycleState,
      input.reason,
      updatedTask.mode,
    );
    const turn = this.runtimeService.beginTurn(input.taskId);
    this.runPrompt({
      taskId: task.taskId,
      sessionId: task.sessionId,
      turnId: turn.turnId,
      prompt: input.prompt,
    });
  }

  private syncLifecycleAfterPrompt(taskId: string, stopReason?: string): void {
    const task = this.runtimeService.getTask(taskId);
    if (
      task.lifecycleState === 'planning' &&
      isPlanningCompletionStopReason(stopReason)
    ) {
      const updatedTask = this.runtimeService.updateLifecycleState(
        taskId,
        'awaiting_confirmation',
        stopReason ?? 'plan_turn_completed',
      );
      this.emitLifecycleStateChanged(
        updatedTask.taskId,
        updatedTask.sessionId,
        'awaiting_confirmation',
        stopReason ?? 'plan_turn_completed',
        updatedTask.mode,
      );
      return;
    }

    if (
      task.lifecycleState === 'executing' &&
      isExecutionCompletionStopReason(stopReason)
    ) {
      void this.handleExecutionCompleted(taskId, stopReason);
    }
  }

  private async handleExecutionCompleted(
    taskId: string,
    reason?: string,
  ): Promise<void> {
    const task = this.runtimeService.getTask(taskId);
    const config = await this.workspaceAutoCheckService.getConfig(task.cwd);
    task.autoCheckConfig = config;
    if (!config.enabled || config.steps.length === 0) {
      const updatedTask = this.runtimeService.updateLifecycleState(
        taskId,
        'awaiting_review',
        reason,
      );
      this.emitLifecycleStateChanged(
        updatedTask.taskId,
        updatedTask.sessionId,
        'awaiting_review',
        reason,
        updatedTask.mode,
      );
      return;
    }

    const autoCheckingTask = this.runtimeService.updateLifecycleState(
      taskId,
      'auto_checking',
      'auto_check_started',
    );
    this.emitLifecycleStateChanged(
      autoCheckingTask.taskId,
      autoCheckingTask.sessionId,
      'auto_checking',
      'auto_check_started',
      autoCheckingTask.mode,
    );
    const autoCheckRunId = randomUUID();
    this.emit({
      type: 'auto-check-started',
      taskId,
      sessionId: task.sessionId,
      run: {
        autoCheckRunId,
        steps: config.steps,
      },
    });
    const result = await this.workspaceAutoCheckService.runWithProgress(
      task.cwd,
      config,
      (step) => {
        this.emit({
          type: 'auto-check-step',
          taskId,
          sessionId: task.sessionId,
          step,
        });
      },
      autoCheckRunId,
    );
    task.latestAutoCheckResult = result;
    this.emit({
      type: 'auto-check-completed',
      taskId,
      sessionId: task.sessionId,
      autoCheckRunId,
      result,
    });

    if (result.success) {
      const updatedTask = this.runtimeService.updateLifecycleState(
        taskId,
        'awaiting_review',
        'auto_check_passed',
        result,
      );
      this.emitLifecycleStateChanged(
        updatedTask.taskId,
        updatedTask.sessionId,
        'awaiting_review',
        'auto_check_passed',
        updatedTask.mode,
        result,
      );
      return;
    }

    const updatedTask = this.runtimeService.updateLifecycleState(
      taskId,
      'executing',
      'auto_check_failed',
      result,
    );
    this.emitLifecycleStateChanged(
      updatedTask.taskId,
      updatedTask.sessionId,
      'executing',
      'auto_check_failed',
      updatedTask.mode,
      result,
    );
    const turn = this.runtimeService.beginTurn(taskId);
    const failedStep = result.failedStep ?? {
      stepId: 'unknown',
      name: 'unknown',
      command: result.command,
      success: false,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      ranAt: result.ranAt,
    };
    const feedback = {
      ...buildAutoCheckFailureFeedback(failedStep),
      autoCheckRunId,
    };
    this.emit({
      type: 'auto-check-feedback-prepared',
      taskId,
      sessionId: task.sessionId,
      feedback,
    });
    this.runPrompt({
      taskId,
      sessionId: task.sessionId,
      turnId: turn.turnId,
      prompt: feedback.prompt,
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
