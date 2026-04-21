/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'share' */
import type { ChatRuntimeState } from '../../share/chat.js';
import type { ServiceEvent } from '../../share/clineSessionOrchestratorEvent.js';
import type { AutoCheckResult, TaskLifecycleState } from '../../share/task.js';
import type {
  AgentServicePort,
  AutoCheckCoordinatorPort,
  LifecycleServicePort,
  PromptInput,
  RuntimeServicePort,
} from '../entity/clineSessionPromptCoordinator.js';
type EmitEvent = (event: ServiceEvent) => void;
export class ClineSessionPromptCoordinator {
  constructor(
    private readonly agentService: AgentServicePort,
    private readonly runtimeService: RuntimeServicePort,
    private readonly lifecycleService: LifecycleServicePort,
    private readonly autoCheckCoordinator: AutoCheckCoordinatorPort,
    private readonly emit: EmitEvent,
  ) {}
  runPrompt(input: PromptInput): void {
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
        const latestTask = this.runtimeService.getTask(input.taskId);
        const latestTurn = latestTask.turns.find(
          (turn) => turn.turnId === input.turnId,
        );
        if (
          latestTurn?.state === 'aborted' &&
          latestTurn.reason === 'cancelled'
        )
          return;
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
        if (
          this.lifecycleService.shouldSyncAfterPrompt(promptResponse.stopReason)
        ) {
          this.syncLifecycleAfterPrompt(
            input.taskId,
            promptResponse.stopReason,
          );
        }
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
  async ensureSessionMode(taskId: string, mode: 'plan' | 'act'): Promise<void> {
    const task = this.runtimeService.getTask(taskId);
    const sessionMode = this.agentService.getSession(task.sessionId).mode;
    const effectiveMode =
      sessionMode === 'plan' || sessionMode === 'act' ? sessionMode : task.mode;
    if (effectiveMode === mode) {
      if (task.mode !== mode) this.runtimeService.updateTaskMode(taskId, mode);
      return;
    }
    await this.agentService.setSessionMode({
      sessionId: task.sessionId,
      modeId: mode,
    });
    this.runtimeService.updateTaskMode(taskId, mode);
  }
  private async restoreExpectedSessionMode(
    taskId: string,
    mode: 'plan' | 'act',
  ): Promise<void> {
    const task = this.runtimeService.getTask(taskId);
    await this.agentService.setSessionMode({
      sessionId: task.sessionId,
      modeId: mode,
    });
    this.runtimeService.updateTaskMode(taskId, mode);
  }
  syncTaskModeWithLifecycle(taskId: string, mode: 'plan' | 'act'): void {
    const task = this.runtimeService.getTask(taskId);
    const expectedMode = this.runtimeService.expectedModeFor(taskId);
    if (expectedMode && mode !== expectedMode) {
      void this.restoreExpectedSessionMode(taskId, expectedMode).catch(
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
  restartTaskWithPrompt(input: {
    taskId: string;
    mode: 'plan' | 'act';
    lifecycleState: TaskLifecycleState;
    prompt: string;
    reason: string;
  }): Promise<void> {
    return this.restartTaskWithPromptInternal(input);
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
    const resolution = this.lifecycleService.resolvePostPrompt(
      task,
      stopReason,
    );
    if (resolution.kind === 'transition') {
      const updatedTask = this.runtimeService.updateLifecycleState(
        taskId,
        resolution.lifecycleState,
        resolution.reason,
      );
      this.emitLifecycleStateChanged(
        updatedTask.taskId,
        updatedTask.sessionId,
        resolution.lifecycleState,
        resolution.reason,
        updatedTask.mode,
      );
      return;
    }
    if (resolution.kind === 'execution-completed')
      void this.handleExecutionCompleted(taskId, resolution.reason);
  }

  private async handleExecutionCompleted(
    taskId: string,
    reason?: string,
  ): Promise<void> {
    await this.autoCheckCoordinator.handleExecutionCompleted({
      taskId,
      reason,
      emitLifecycleStateChanged: (
        emittedTaskId,
        sessionId,
        state,
        emittedReason,
        mode,
        autoCheckResult,
      ) => {
        this.emitLifecycleStateChanged(
          emittedTaskId,
          sessionId,
          state,
          emittedReason,
          mode,
          autoCheckResult,
        );
      },
      emitAutoCheckStarted: (emittedTaskId, sessionId, run) => {
        this.emit({
          type: 'auto-check-started',
          taskId: emittedTaskId,
          sessionId,
          run,
        });
      },
      emitAutoCheckStep: (emittedTaskId, sessionId, step) => {
        this.emit({
          type: 'auto-check-step',
          taskId: emittedTaskId,
          sessionId,
          step,
        });
      },
      emitAutoCheckCompleted: (
        emittedTaskId,
        sessionId,
        autoCheckRunId,
        result,
      ) => {
        this.emit({
          type: 'auto-check-completed',
          taskId: emittedTaskId,
          sessionId,
          autoCheckRunId,
          result,
        });
      },
      emitAutoCheckFeedbackPrepared: (emittedTaskId, sessionId, feedback) => {
        this.emit({
          type: 'auto-check-feedback-prepared',
          taskId: emittedTaskId,
          sessionId,
          feedback,
        });
      },
      beginTurn: (targetTaskId) => this.runtimeService.beginTurn(targetTaskId),
      runPrompt: (promptInput) => {
        this.runPrompt(promptInput);
      },
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
}
