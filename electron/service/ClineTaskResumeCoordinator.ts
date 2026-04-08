import { randomUUID } from 'node:crypto';
import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
} from 'cline';
import { ClineTaskRuntimeService } from './ClineTaskRuntimeService.js';

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

export class ClineTaskResumeCoordinator {
  constructor(private readonly runtimeService: ClineTaskRuntimeService) {}

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
