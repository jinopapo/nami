import { randomUUID } from 'node:crypto';
import type { PendingApproval, TaskRuntime } from '../entity/clineSession.js';
import type { ClineSdkRuntimeSession } from '../entity/clineSdkConfig.js';
import type { TaskWorkspaceContext } from '../entity/taskWorkspace.js';

const EXPECTED_MODE_BY_LIFECYCLE_STATE: Partial<
  Record<TaskRuntime['lifecycleState'], TaskRuntime['mode']>
> = {
  waiting_dependencies: 'plan',
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
    session: ClineSdkRuntimeSession,
    initialPrompt: string,
    workspace: TaskWorkspaceContext,
    taskId = this.createTaskId(),
    dependencyTaskIds: string[] = [],
    pendingDependencyTaskIds: string[] = [],
  ): TaskRuntime {
    const lifecycleState: TaskRuntime['lifecycleState'] =
      pendingDependencyTaskIds.length > 0
        ? 'waiting_dependencies'
        : 'before_start';
    const task: TaskRuntime = {
      taskId,
      sessionId: session.sessionId,
      cwd: session.cwd,
      projectWorkspacePath: workspace.projectWorkspacePath,
      taskWorkspacePath: workspace.taskWorkspacePath,
      taskBranchName: workspace.taskBranchName,
      taskBranchManagement: workspace.taskBranchManagement,
      baseBranchName: workspace.baseBranchName,
      reviewMergePolicy: workspace.reviewMergePolicy,
      createdAt: new Date(session.createdAt).toISOString(),
      updatedAt: new Date(session.lastActivityAt).toISOString(),
      mode: 'plan',
      lifecycleState,
      runtimeState: 'idle',
      workspaceStatus: workspace.workspaceStatus,
      mergeStatus: workspace.mergeStatus,
      mergeFailureReason: workspace.mergeFailureReason,
      mergeMessage: workspace.mergeMessage,
      dependencyTaskIds,
      pendingDependencyTaskIds,
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

  listTasks(): TaskRuntime[] {
    return [...this.tasks.values()];
  }

  findTaskIdBySession(sessionId: string): string | undefined {
    return this.taskIdsBySession.get(sessionId);
  }

  beginTurn(taskId: string, prompt?: string): TaskRuntime['turns'][number] {
    const task = this.getTask(taskId);
    const turn: TaskRuntime['turns'][number] = {
      turnId: randomUUID(),
      prompt,
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
    state: TaskRuntime['runtimeState'],
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
    state: TaskRuntime['runtimeState'],
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

  updateTaskSession(
    taskId: string,
    session: Pick<ClineSdkRuntimeSession, 'sessionId' | 'mode'>,
  ): TaskRuntime {
    const task = this.getTask(taskId);
    this.taskIdsBySession.delete(task.sessionId);
    task.sessionId = session.sessionId;
    if (session.mode === 'plan' || session.mode === 'act') {
      task.mode = session.mode;
    }
    task.updatedAt = new Date().toISOString();
    this.taskIdsBySession.set(session.sessionId, taskId);
    return task;
  }

  updateLifecycleState(
    taskId: string,
    state: TaskRuntime['lifecycleState'],
    reason?: string,
    autoCheckResult?: TaskRuntime['latestAutoCheckResult'],
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
        | 'taskBranchManagement'
        | 'baseBranchName'
        | 'reviewMergePolicy'
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

  expectedModeFor(taskId: string): TaskRuntime['mode'] | undefined {
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

  updateTaskDependencies(
    taskId: string,
    input: {
      dependencyTaskIds: string[];
      pendingDependencyTaskIds: string[];
    },
  ): TaskRuntime {
    const task = this.getTask(taskId);
    task.dependencyTaskIds = [...input.dependencyTaskIds];
    task.pendingDependencyTaskIds = [...input.pendingDependencyTaskIds];
    task.updatedAt = new Date().toISOString();
    return task;
  }
}
