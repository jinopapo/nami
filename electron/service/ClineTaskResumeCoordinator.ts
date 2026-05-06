import { randomUUID } from 'node:crypto';
import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
} from 'cline';
import type { PendingApproval, TaskRuntime } from '../entity/clineSession.js';

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
      response: RequestPermissionResponse;
    }
  | {
      kind: 'pending';
      approvalId: string;
      taskId: string;
      sessionId: string;
      turnId: string;
      request: RequestPermissionRequest;
      runtimeEvent: RuntimeResumeEvent;
    };

type RuntimeServicePort = {
  getTask(taskId: string): TaskRuntime;
  takeApproval(approvalId: string): PendingApproval;
  updateRuntimeState(
    taskId: string,
    state: 'running' | 'waiting_permission',
    reason?: string,
    turnId?: string,
  ): TaskRuntime;
  clearPendingHumanDecision(taskId: string): TaskRuntime;
  findTaskIdBySession(sessionId: string): string | undefined;
  storeApproval(approvalId: string, approval: PendingApproval): void;
};

export class ClineTaskResumeCoordinator {
  private readonly retryByTask = new Map<string, Promise<void>>();

  constructor(private readonly runtimeService: RuntimeServicePort) {}

  resumeTask(input: ResumeTaskInput): RuntimeResumeEvent {
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

      return {
        taskId: input.taskId,
        sessionId: task.sessionId,
        turnId: pending.turnId,
        state: 'running',
        reason: 'permission_resolved',
      };
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

      return {
        taskId: input.taskId,
        sessionId: task.sessionId,
        turnId: pendingHumanDecision.turnId,
        state: 'running',
        reason: input.reason,
      };
    }

    this.runtimeService.updateRuntimeState(
      input.taskId,
      'running',
      input.reason,
      task.activeTurnId,
    );

    return {
      taskId: input.taskId,
      sessionId: task.sessionId,
      turnId: task.activeTurnId,
      state: 'running',
      reason: input.reason,
    };
  }

  async retryTask(
    taskId: string,
    startRetry: (prompt: string) => Promise<void>,
  ): Promise<void> {
    const inFlight = this.retryByTask.get(taskId);
    if (inFlight) {
      return inFlight;
    }

    const promise = this.retryTaskInternal(taskId, startRetry).finally(() => {
      this.retryByTask.delete(taskId);
    });
    this.retryByTask.set(taskId, promise);
    return promise;
  }

  private async retryTaskInternal(
    taskId: string,
    startRetry: (prompt: string) => Promise<void>,
  ): Promise<void> {
    const task = this.runtimeService.getTask(taskId);
    if (!['aborted', 'error'].includes(task.runtimeState)) {
      throw new Error('Only stopped or errored tasks can be resumed.');
    }

    const latestPrompt = [...task.turns]
      .reverse()
      .find(
        (turn) => typeof turn.prompt === 'string' && turn.prompt.trim(),
      )?.prompt;

    if (!latestPrompt) {
      throw new Error('Retry prompt not found for this task.');
    }

    await startRetry(latestPrompt);
  }

  preparePermissionRequest(
    request: RequestPermissionRequest,
  ): PermissionHandlingResult {
    const taskId = this.runtimeService.findTaskIdBySession(request.sessionId);
    if (!taskId) {
      return {
        kind: 'reject',
        response: {
          outcome: { outcome: 'selected', optionId: 'reject_once' },
        },
      };
    }

    const task = this.runtimeService.getTask(taskId);
    const turnId = task.activeTurnId;
    if (!turnId) {
      return {
        kind: 'reject',
        response: {
          outcome: { outcome: 'selected', optionId: 'reject_once' },
        },
      };
    }

    const approvalId = randomUUID();

    return {
      kind: 'pending',
      approvalId,
      taskId,
      sessionId: request.sessionId,
      turnId,
      request,
      runtimeEvent: {
        taskId,
        sessionId: request.sessionId,
        turnId,
        state: 'running',
        reason: 'permission_requested',
      },
    };
  }

  storePermissionRequest(
    approvalId: string,
    request: RequestPermissionRequest,
    turnId: string,
    resolve: (response: RequestPermissionResponse) => void,
  ): void {
    const taskId = this.runtimeService.findTaskIdBySession(request.sessionId);
    if (!taskId) {
      throw new Error(`Task not found for session: ${request.sessionId}`);
    }

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
  }
}
