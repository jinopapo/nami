/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'share' */
import { randomUUID } from 'node:crypto';
import type { ClineAcpSession } from 'cline';
import type { ChatRuntimeState } from '../../share/chat.js';
import type { AutoCheckResult, TaskLifecycleState } from '../../share/task.js';
import type {
  PendingApproval,
  TaskRuntime,
  TaskTurnRecord,
} from '../entity/clineSession.js';
import type { TaskWorkspaceContext } from '../entity/taskWorkspace.js';

const EXPECTED_MODE_BY_LIFECYCLE_STATE: Partial<
  Record<TaskLifecycleState, 'plan' | 'act'>
> = {
  before_start: 'plan',
  planning: 'plan',
  awaiting_confirmation: 'plan',
  executing: 'act',
  auto_checking: 'act',
  awaiting_review: 'act',
};

export class ClineTaskRuntimeService {
  private readonly approvals = new Map<string, PendingApproval>();
  private readonly tasks = new Map<string, TaskRuntime>();
  private readonly taskIdsBySession = new Map<string, string>();

  createTaskId(): string {
    return randomUUID();
  }

  registerTask(
    session: ClineAcpSession,
    initialPrompt: string,
    workspace: TaskWorkspaceContext,
    taskId = this.createTaskId(),
  ): TaskRuntime {
    const task: TaskRuntime = {
      taskId,
      sessionId: session.sessionId,
      cwd: workspace.taskWorkspacePath,
      projectWorkspacePath: workspace.projectWorkspacePath,
      taskWorkspacePath: workspace.taskWorkspacePath,
      taskBranchName: workspace.taskBranchName,
      baseBranchName: workspace.baseBranchName,
      createdAt: new Date(session.createdAt).toISOString(),
      updatedAt: new Date(session.lastActivityAt).toISOString(),
      mode: 'plan',
      lifecycleState: 'before_start',
      runtimeState: 'idle',
      workspaceStatus: workspace.workspaceStatus,
      mergeStatus: workspace.mergeStatus,
      mergeFailureReason: workspace.mergeFailureReason,
      mergeMessage: workspace.mergeMessage,
      initialPrompt,
      turns: [],
    };
    this.tasks.set(taskId, task);
    this.taskIdsBySession.set(session.sessionId, taskId);
    return task;
  }

  getTask(taskId: string): TaskRuntime {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    return task;
  }

  findTaskIdBySession(sessionId: string): string | undefined {
    return this.taskIdsBySession.get(sessionId);
  }

  beginTurn(taskId: string): TaskTurnRecord {
    const task = this.getTask(taskId);
    const turn: TaskTurnRecord = {
      turnId: randomUUID(),
      state: 'submitting',
      startedAt: new Date().toISOString(),
    };
    task.turns.push(turn);
    task.activeTurnId = turn.turnId;
    task.updatedAt = new Date().toISOString();
    return turn;
  }

  completeTurn(
    taskId: string,
    turnId: string,
    state: ChatRuntimeState,
    reason?: string,
  ): TaskRuntime {
    const task = this.getTask(taskId);
    const turn = task.turns.find((item) => item.turnId === turnId);
    if (turn) {
      turn.state = state;
      turn.reason = reason;
      turn.endedAt = new Date().toISOString();
    }
    task.activeTurnId = undefined;
    return this.updateRuntimeState(taskId, state, reason, turnId);
  }

  updateRuntimeState(
    taskId: string,
    state: ChatRuntimeState,
    reason?: string,
    turnId?: string,
  ): TaskRuntime {
    const task = this.getTask(taskId);
    task.runtimeState = state;
    task.updatedAt = new Date().toISOString();
    if (turnId) {
      const turn = task.turns.find((item) => item.turnId === turnId);
      if (turn) {
        turn.state = state;
        turn.reason = reason;
      }
    }
    return task;
  }

  updateTaskMode(taskId: string, mode: 'plan' | 'act'): TaskRuntime {
    const task = this.getTask(taskId);
    task.mode = mode;
    task.updatedAt = new Date().toISOString();
    return task;
  }

  updateLifecycleState(
    taskId: string,
    state: TaskLifecycleState,
    reason?: string,
    autoCheckResult?: AutoCheckResult,
  ): TaskRuntime {
    const task = this.getTask(taskId);
    task.lifecycleState = state;
    task.updatedAt = new Date().toISOString();
    if (autoCheckResult) {
      task.latestAutoCheckResult = autoCheckResult;
    }
    const expectedMode = EXPECTED_MODE_BY_LIFECYCLE_STATE[state];
    if (expectedMode && task.mode !== expectedMode) {
      task.mode = expectedMode;
    }
    return task;
  }

  updateTaskWorkspace(
    taskId: string,
    workspace: Partial<
      Pick<
        TaskRuntime,
        | 'cwd'
        | 'projectWorkspacePath'
        | 'taskWorkspacePath'
        | 'taskBranchName'
        | 'baseBranchName'
        | 'workspaceStatus'
        | 'mergeStatus'
        | 'mergeFailureReason'
        | 'mergeMessage'
      >
    >,
  ): TaskRuntime {
    const task = this.getTask(taskId);
    Object.assign(task, workspace);
    task.updatedAt = new Date().toISOString();
    return task;
  }

  expectedModeFor(taskId: string): 'plan' | 'act' | undefined {
    const task = this.getTask(taskId);
    return EXPECTED_MODE_BY_LIFECYCLE_STATE[task.lifecycleState];
  }

  storeApproval(approvalId: string, approval: PendingApproval): void {
    this.approvals.set(approvalId, approval);
  }

  takeApproval(approvalId: string): PendingApproval {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error(`Approval not found: ${approvalId}`);
    }
    this.approvals.delete(approvalId);
    return approval;
  }

  clearPendingHumanDecision(taskId: string): TaskRuntime {
    const task = this.getTask(taskId);
    delete task.pendingHumanDecision;
    task.updatedAt = new Date().toISOString();
    return task;
  }
}
