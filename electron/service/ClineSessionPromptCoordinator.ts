import type {
  AgentServicePort,
  AutoApprovalServicePort,
  AutoCheckCoordinatorPort,
  LifecycleServicePort,
  PromptInput,
  RuntimeServicePort,
} from '../entity/clineSessionPromptCoordinator.js';
type EmitEvent = Parameters<
  AutoCheckCoordinatorPort['handleExecutionCompleted']
>[0]['emit'];
type RuntimeTask = ReturnType<RuntimeServicePort['getTask']>;
type ChatRuntimeState = RuntimeTask['runtimeState'];
type TaskLifecycleState = RuntimeTask['lifecycleState'];
type AutoCheckResult = Parameters<
  RuntimeServicePort['updateLifecycleState']
>[3];
type RestartTaskInput = {
  taskId: string;
  mode: 'plan' | 'act';
  lifecycleState: TaskLifecycleState;
  prompt: string;
  reason: string;
};
const AUTO_APPROVAL_START_EXECUTION_REASON = 'auto_approval_start_execution';
const EXECUTION_START_PROMPT =
  'これまでの計画を踏まえて、actモードとして実行を開始してください。';
export class ClineSessionPromptCoordinator {
  private readonly operationsByTask = new Map<string, Promise<void>>();

  constructor(
    private readonly agentService: AgentServicePort,
    private readonly runtimeService: RuntimeServicePort,
    private readonly lifecycleService: LifecycleServicePort,
    private readonly autoCheckCoordinator: AutoCheckCoordinatorPort,
    private readonly autoApprovalService: AutoApprovalServicePort,
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
    if (this.isTurnCancelled(input)) return;
    const expectedMode = this.runtimeService.expectedModeFor(input.taskId);
    if (expectedMode) await this.ensureSessionMode(input.taskId, expectedMode);
    if (this.isTurnCancelled(input)) return;
    this.updatePromptRuntimeState(input, 'running', 'prompt_started');

    const promptResponse = await this.agentService.prompt({
      sessionId: input.sessionId,
      prompt: input.prompt,
    });

    if (this.isTurnCancelled(input)) return;

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
    if (this.lifecycleService.shouldSyncAfterPrompt(promptResponse.stopReason))
      await this.syncLifecycleAfterPrompt(
        input.taskId,
        promptResponse.stopReason,
      );
  }

  private isTurnCancelled(input: PromptInput): boolean {
    const task = this.runtimeService.getTask(input.taskId);
    const turn = task.turns.find(({ turnId }) => turnId === input.turnId);
    return turn?.state === 'aborted' && turn.reason === 'cancelled';
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
    this.updatePromptRuntimeState(input, 'error', message);
    this.emit({
      type: 'error',
      taskId: input.taskId,
      sessionId: input.sessionId,
      message,
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

  syncTaskModeWithLifecycle(taskId: string, mode: 'plan' | 'act'): void {
    const task = this.runtimeService.getTask(taskId);
    void this.enqueueTaskOperation(taskId, async () => {
      const expectedMode = this.runtimeService.expectedModeFor(taskId);
      if (expectedMode && mode !== expectedMode) {
        await this.ensureSessionMode(taskId, expectedMode);
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

  restartTaskWithPrompt(input: RestartTaskInput): Promise<void> {
    return this.enqueueTaskOperation(input.taskId, async () => {
      await this.ensureSessionMode(input.taskId, input.mode);
      const updatedTask = this.runtimeService.updateLifecycleState(
        input.taskId,
        input.lifecycleState,
        input.reason,
      );
      this.emitLifecycleStateChanged(updatedTask, input.reason);
      await this.beginAndRunPrompt(updatedTask, input.prompt);
    });
  }

  async retryTask(input: { taskId: string; prompt: string }): Promise<void> {
    await this.enqueueTaskOperation(input.taskId, async () => {
      const expectedMode = this.runtimeService.expectedModeFor(input.taskId);

      if (expectedMode) {
        await this.ensureSessionMode(input.taskId, expectedMode);
      }

      const task = this.runtimeService.getTask(input.taskId);
      await this.beginAndRunPrompt(task, input.prompt);
    });
  }

  private async syncLifecycleAfterPrompt(
    taskId: string,
    stopReason?: string,
  ): Promise<void> {
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
      this.emitLifecycleStateChanged(updatedTask, resolution.reason);
      await this.startExecutionWhenAutoApprovalEnabled(updatedTask.taskId);
      return;
    }
    if (resolution.kind === 'execution-completed')
      void this.handleExecutionCompleted(taskId, resolution.reason);
  }

  private async startExecutionWhenAutoApprovalEnabled(
    taskId: string,
  ): Promise<void> {
    const task = this.runtimeService.getTask(taskId);
    if (task.lifecycleState !== 'awaiting_confirmation') {
      return;
    }

    const config = await this.autoApprovalService.getConfig(
      task.projectWorkspacePath,
    );
    if (!config.enabled) {
      return;
    }

    await this.ensureSessionMode(taskId, 'act');
    const updatedTask = this.runtimeService.updateLifecycleState(
      taskId,
      'executing',
      AUTO_APPROVAL_START_EXECUTION_REASON,
    );
    this.emitLifecycleStateChanged(
      updatedTask,
      AUTO_APPROVAL_START_EXECUTION_REASON,
    );
    await this.beginAndRunPrompt(updatedTask, EXECUTION_START_PROMPT);
  }

  private async beginAndRunPrompt(
    task: Pick<RuntimeTask, 'taskId' | 'sessionId'>,
    prompt: string,
  ): Promise<void> {
    const turn = this.runtimeService.beginTurn(task.taskId, prompt);
    await this.runPromptInCurrentQueue({
      taskId: task.taskId,
      sessionId: task.sessionId,
      turnId: turn.turnId,
      prompt,
    });
  }

  private async handleExecutionCompleted(
    taskId: string,
    reason?: string,
  ): Promise<void> {
    await this.autoCheckCoordinator.handleExecutionCompleted({
      taskId,
      reason,
      emit: (event) => this.emit(event),
      beginTurn: (targetTaskId, prompt) =>
        this.runtimeService.beginTurn(targetTaskId, prompt),
      runPrompt: (promptInput) => this.runPrompt(promptInput),
    });
  }

  private updatePromptRuntimeState(
    input: PromptInput,
    state: ChatRuntimeState,
    reason?: string,
  ): void {
    this.runtimeService.updateRuntimeState(
      input.taskId,
      state,
      reason,
      input.turnId,
    );
    this.emit({
      type: 'chat-runtime-state-changed',
      taskId: input.taskId,
      sessionId: input.sessionId,
      turnId: input.turnId,
      state,
      reason,
    });
  }

  private emitLifecycleStateChanged(
    task: Pick<RuntimeTask, 'taskId' | 'sessionId' | 'lifecycleState' | 'mode'>,
    reason?: string,
    autoCheckResult?: AutoCheckResult,
  ): void {
    this.emit({
      type: 'task-lifecycle-state-changed',
      taskId: task.taskId,
      sessionId: task.sessionId,
      state: task.lifecycleState,
      mode: task.mode,
      reason,
      autoCheckResult,
    });
  }
}
