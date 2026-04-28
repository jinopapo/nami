/* eslint-disable max-lines */
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
  private readonly operationsByTask = new Map<string, Promise<void>>();

  constructor(
    private readonly agentService: AgentServicePort,
    private readonly runtimeService: RuntimeServicePort,
    private readonly lifecycleService: LifecycleServicePort,
    private readonly autoCheckCoordinator: AutoCheckCoordinatorPort,
    private readonly emit: EmitEvent,
  ) {}

  private enqueueTaskOperation(
    taskId: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    const previous = this.operationsByTask.get(taskId) ?? Promise.resolve();
    const queued = previous.catch(() => undefined).then(operation);
    let tracked: Promise<void>;
    tracked = queued.finally(() => {
      if (this.operationsByTask.get(taskId) === tracked)
        this.operationsByTask.delete(taskId);
    });
    this.operationsByTask.set(taskId, tracked);
    return tracked;
  }

  runPrompt(input: PromptInput): void {
    void this.enqueueTaskOperation(input.taskId, async () => {
      await this.runPromptInternal(input);
    }).catch((error: unknown) => {
      this.handlePromptFailure(input, error);
    });
  }

  private async runPromptInternal(input: PromptInput): Promise<void> {
    const latestTask = this.runtimeService.getTask(input.taskId);
    const latestTurn = latestTask.turns.find(
      (turn) => turn.turnId === input.turnId,
    );
    if (latestTurn?.state === 'aborted' && latestTurn.reason === 'cancelled')
      return;

    await this.ensureExpectedSessionMode(input.taskId);

    const postSyncTask = this.runtimeService.getTask(input.taskId);
    const postSyncTurn = postSyncTask.turns.find(
      (turn) => turn.turnId === input.turnId,
    );
    if (
      postSyncTurn?.state === 'aborted' &&
      postSyncTurn.reason === 'cancelled'
    )
      return;

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

    const promptResponse = await this.agentService.prompt({
      sessionId: input.sessionId,
      prompt: input.prompt,
    });

    const postPromptTask = this.runtimeService.getTask(input.taskId);
    const postPromptTurn = postPromptTask.turns.find(
      (turn) => turn.turnId === input.turnId,
    );
    if (
      postPromptTurn?.state === 'aborted' &&
      postPromptTurn.reason === 'cancelled'
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
      this.syncLifecycleAfterPrompt(input.taskId, promptResponse.stopReason);
    }
  }

  private async runPromptInCurrentQueue(input: PromptInput): Promise<void> {
    try {
      await this.runPromptInternal(input);
    } catch (error) {
      this.handlePromptFailure(input, error);
    }
  }

  private handlePromptFailure(input: PromptInput, error: unknown): void {
    const message =
      error instanceof Error ? error.message : 'Failed to execute task';
    this.runtimeService.completeTurn(
      input.taskId,
      input.turnId,
      'error',
      message,
    );
    this.emitRuntimeStateChanged(
      input.taskId,
      input.sessionId,
      input.turnId,
      'error',
      message,
    );
    this.emit({
      type: 'error',
      taskId: input.taskId,
      sessionId: input.sessionId,
      message,
    });
  }

  private async ensureExpectedSessionMode(taskId: string): Promise<void> {
    const expectedMode = this.runtimeService.expectedModeFor(taskId);
    if (!expectedMode) {
      return;
    }
    await this.ensureSessionMode(taskId, expectedMode);
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
  private async restoreExpectedSessionMode(taskId: string): Promise<void> {
    const expectedMode = this.runtimeService.expectedModeFor(taskId);
    if (!expectedMode) {
      return;
    }
    await this.ensureSessionMode(taskId, expectedMode);
  }

  syncTaskModeWithLifecycle(taskId: string, mode: 'plan' | 'act'): void {
    const task = this.runtimeService.getTask(taskId);
    void this.enqueueTaskOperation(taskId, async () => {
      const expectedMode = this.runtimeService.expectedModeFor(taskId);
      if (expectedMode && mode !== expectedMode) {
        await this.restoreExpectedSessionMode(taskId);
        return;
      }
      this.runtimeService.updateTaskMode(taskId, mode);
    }).catch((error: unknown) => {
      this.emit({
        type: 'error',
        taskId,
        sessionId: task.sessionId,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to restore expected session mode',
      });
    });
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
    await this.enqueueTaskOperation(input.taskId, async () => {
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
      const turn = this.runtimeService.beginTurn(input.taskId, input.prompt);
      await this.runPromptInCurrentQueue({
        taskId: updatedTask.taskId,
        sessionId: updatedTask.sessionId,
        turnId: turn.turnId,
        prompt: input.prompt,
      });
    });
  }

  async retryTask(input: { taskId: string; prompt: string }): Promise<void> {
    await this.enqueueTaskOperation(input.taskId, async () => {
      const expectedMode = this.runtimeService.expectedModeFor(input.taskId);

      if (expectedMode) {
        await this.ensureSessionMode(input.taskId, expectedMode);
      }

      const task = this.runtimeService.getTask(input.taskId);
      const turn = this.runtimeService.beginTurn(input.taskId, input.prompt);
      await this.runPromptInCurrentQueue({
        taskId: task.taskId,
        sessionId: task.sessionId,
        turnId: turn.turnId,
        prompt: input.prompt,
      });
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
      beginTurn: (targetTaskId, prompt) =>
        this.runtimeService.beginTurn(targetTaskId, prompt),
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
