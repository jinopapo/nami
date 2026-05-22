import type {
  TaskRuntime,
  ToolPermissionRequest,
  ToolPermissionResponse,
} from '../entity/clineSession.js';

type ResumeTaskInput = {
  taskId: string;
  reason: 'permission' | 'human_decision' | 'resume';
  payload?: {
    approvalId?: string;
    decision?: 'approve' | 'reject';
    requestId?: string;
    value?: unknown;
  };
};

type RuntimeResumeEvent = {
  taskId: string;
  sessionId: string;
  turnId?: string;
  state: 'running';
  reason: string;
};

type PermissionHandlingResult =
  | {
      kind: 'reject';
      response: ToolPermissionResponse;
    }
  | {
      kind: 'pending';
      approvalId: string;
      taskId: string;
      sessionId: string;
      turnId: string;
      runtimeEvent: RuntimeResumeEvent;
    };

type RuntimeServicePort = {
  getTask(taskId: string): TaskRuntime;
  beginTurn(taskId: string, prompt?: string): { turnId: string };
  completeTurn(
    taskId: string,
    turnId: string,
    state: TaskRuntime['runtimeState'],
    reason?: string,
  ): TaskRuntime;
  updateRuntimeState(
    taskId: string,
    state: TaskRuntime['runtimeState'],
    reason?: string,
    turnId?: string,
  ): TaskRuntime;
};

type ResumeServicePort = {
  resumeTask(input: ResumeTaskInput): RuntimeResumeEvent;
  retryTask(
    taskId: string,
    startRetry: (prompt: string) => Promise<void>,
  ): Promise<void>;
  preparePermissionRequest(
    request: ToolPermissionRequest,
  ): PermissionHandlingResult;
  storePermissionRequest(
    approvalId: string,
    request: ToolPermissionRequest,
    turnId: string,
    resolve: (response: ToolPermissionResponse) => void,
  ): void;
};

export class ClineTaskInteractionCoordinator {
  constructor(
    private readonly ports: {
      runtimeService: RuntimeServicePort;
      resumeService: ResumeServicePort;
      runPrompt: (input: {
        taskId: string;
        sessionId: string;
        turnId: string;
        prompt: string;
      }) => void;
      retryPrompt: (input: { taskId: string; prompt: string }) => void;
      cancelSession: (input: { sessionId: string }) => Promise<void>;
      emitRuntimeStateChanged: (
        taskId: string,
        sessionId: string,
        turnId: string | undefined,
        state: TaskRuntime['runtimeState'],
        reason?: string,
      ) => void;
      emit: (event: unknown) => void;
    },
  ) {}

  sendMessage(input: { taskId: string; prompt: string }): {
    taskId: string;
    sessionId: string;
    turnId: string;
  } {
    const task = this.ports.runtimeService.getTask(input.taskId);
    if (
      ['waiting_dependencies', 'before_start'].includes(task.lifecycleState)
    ) {
      throw new Error('Task must start planning before sending messages.');
    }
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
    const turn = this.ports.runtimeService.beginTurn(task.taskId, input.prompt);
    this.ports.runPrompt({
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
    const task = this.ports.runtimeService.getTask(taskId);
    if (task.activeTurnId) {
      this.ports.runtimeService.completeTurn(
        taskId,
        task.activeTurnId,
        'aborted',
        'cancelled',
      );
    } else {
      this.ports.runtimeService.updateRuntimeState(
        taskId,
        'aborted',
        'cancelled',
      );
    }
    this.ports.emitRuntimeStateChanged(
      taskId,
      task.sessionId,
      undefined,
      'aborted',
      'cancelled',
    );
    await this.ports.cancelSession({ sessionId: task.sessionId });
  }

  async resumeTask(input: ResumeTaskInput): Promise<void> {
    if (input.reason === 'resume') {
      await this.retryTaskAfterError(input.taskId);
      return;
    }
    const runtimeEvent = this.ports.resumeService.resumeTask(input);
    this.ports.emitRuntimeStateChanged(
      runtimeEvent.taskId,
      runtimeEvent.sessionId,
      runtimeEvent.turnId,
      runtimeEvent.state,
      runtimeEvent.reason,
    );
  }

  handlePermissionRequest(
    request: ToolPermissionRequest,
  ): Promise<ToolPermissionResponse> {
    return new Promise((resolve) => {
      const prepared =
        this.ports.resumeService.preparePermissionRequest(request);
      if (prepared.kind === 'reject') {
        resolve(prepared.response);
        return;
      }
      this.ports.resumeService.storePermissionRequest(
        prepared.approvalId,
        request,
        prepared.turnId,
        resolve,
      );
      this.ports.emitRuntimeStateChanged(
        prepared.runtimeEvent.taskId,
        prepared.runtimeEvent.sessionId,
        prepared.runtimeEvent.turnId,
        'waiting_permission',
        'permission_requested',
      );
      this.ports.emit({
        type: 'permission-request',
        taskId: prepared.taskId,
        sessionId: prepared.sessionId,
        turnId: prepared.turnId,
        approvalId: prepared.approvalId,
        request,
      });
    });
  }

  private async retryTaskAfterError(taskId: string): Promise<void> {
    await this.ports.resumeService.retryTask(taskId, (prompt) => {
      this.ports.retryPrompt({ taskId, prompt });
      return Promise.resolve();
    });
  }
}
