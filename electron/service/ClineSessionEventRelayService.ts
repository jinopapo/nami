import type {
  SessionEvent,
  TaskRuntime,
  ToolCallSessionUpdate,
} from '../entity/clineSession.js';

type ChatRuntimeState = TaskRuntime['runtimeState'];

type SessionUpdate = Extract<
  SessionEvent,
  { type: 'session-update' }
>['update'];

type TaskLifecycleState = TaskRuntime['lifecycleState'];

type AutoCheckResult = TaskRuntime['latestAutoCheckResult'];

type WorkspaceEventPayload = {
  projectWorkspacePath?: string;
  taskWorkspacePath?: string;
  taskBranchName?: string;
  taskBranchManagement?: TaskRuntime['taskBranchManagement'];
  baseBranchName?: string;
  reviewMergePolicy?: TaskRuntime['reviewMergePolicy'];
  workspaceStatus?: TaskRuntime['workspaceStatus'];
  mergeStatus?: TaskRuntime['mergeStatus'];
  mergeFailureReason?: TaskRuntime['mergeFailureReason'];
  mergeMessage?: TaskRuntime['mergeMessage'];
  dependencyTaskIds?: TaskRuntime['dependencyTaskIds'];
  pendingDependencyTaskIds?: TaskRuntime['pendingDependencyTaskIds'];
};

type RuntimeServicePort = {
  getTask(taskId: string): TaskRuntime;
  findTaskIdBySession(sessionId: string): string | undefined;
  updateRuntimeState(
    taskId: string,
    state: ChatRuntimeState,
    reason?: string,
    turnId?: string,
  ): TaskRuntime;
};

type AgentServicePort = {
  subscribeSession(
    sessionId: string,
    listener: (event: SessionEvent) => void,
  ): () => void;
};

export class ClineSessionEventRelayService {
  private readonly unsubscribeBySession = new Map<string, () => void>();

  constructor(
    private readonly ports: {
      emit: (event: unknown) => void;
      runtimeService: RuntimeServicePort;
      agentService: AgentServicePort;
      syncTaskModeWithLifecycle: (taskId: string, mode: 'plan' | 'act') => void;
      logToolCall: (input: {
        taskId: string;
        sessionId: string;
        turnId?: string;
        update: ToolCallSessionUpdate;
      }) => Promise<void>;
      isToolCallSessionUpdate: (
        update: SessionUpdate,
      ) => update is ToolCallSessionUpdate;
      toWorkspaceEventPayload: (
        task: Pick<
          TaskRuntime,
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
          | 'dependencyTaskIds'
          | 'pendingDependencyTaskIds'
        >,
      ) => WorkspaceEventPayload;
    },
  ) {}

  emit(event: unknown): void {
    this.ports.emit(event);
  }

  emitTaskCreated(task: TaskRuntime): void {
    this.emit({ type: 'task-created', task });
  }

  emitSessionModeUpdate(
    taskId: string,
    sessionId: string,
    mode: 'plan' | 'act',
  ): void {
    this.emit({
      type: 'session-update',
      taskId,
      sessionId,
      update: {
        sessionUpdate: 'current_mode_update',
        currentModeId: mode,
      },
    });
  }

  emitRuntimeStateChanged(
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

  emitLifecycleStateChanged(
    taskId: string,
    sessionId: string,
    state: TaskLifecycleState,
    reason?: string,
    mode?: 'plan' | 'act',
    autoCheckResult?: AutoCheckResult,
  ): void {
    const task = this.ports.runtimeService.getTask(taskId);
    this.emit({
      type: 'task-lifecycle-state-changed',
      taskId,
      sessionId,
      state,
      ...this.ports.toWorkspaceEventPayload(task),
      mode,
      reason,
      autoCheckResult,
    });
  }

  emitError(
    taskId: string | undefined,
    sessionId: string | undefined,
    message: string,
  ) {
    this.emit({ type: 'error', taskId, sessionId, message });
  }

  private getSessionEndedErrorMessage(
    event: Extract<SessionEvent, { type: 'session-ended' }>,
  ): string {
    return event.error ?? event.stopReason ?? 'error';
  }

  attachSessionListenersOnce(sessionId: string): void {
    if (this.unsubscribeBySession.has(sessionId)) {
      return;
    }

    const unsubscribe = this.ports.agentService.subscribeSession(
      sessionId,
      (event) => {
        if (event.type === 'session-update') {
          const update = event.update;
          const taskId =
            this.ports.runtimeService.findTaskIdBySession(sessionId);
          if (!taskId) {
            return;
          }
          if (update.sessionUpdate === 'current_mode_update') {
            const nextMode = (update as { currentModeId?: unknown })
              .currentModeId;
            if (nextMode === 'plan' || nextMode === 'act') {
              this.ports.syncTaskModeWithLifecycle(taskId, nextMode);
            }
          }
          if (this.ports.isToolCallSessionUpdate(update)) {
            void this.ports.logToolCall({
              taskId,
              sessionId,
              turnId: this.ports.runtimeService.getTask(taskId).activeTurnId,
              update,
            });
          }
          this.emit({
            type: 'session-update',
            taskId,
            sessionId,
            turnId: this.ports.runtimeService.getTask(taskId).activeTurnId,
            update,
          });
          return;
        }

        if (event.type === 'session-ended' && event.stopReason === 'error') {
          const taskId =
            this.ports.runtimeService.findTaskIdBySession(sessionId);
          const errorMessage = this.getSessionEndedErrorMessage(event);
          if (taskId) {
            this.ports.runtimeService.updateRuntimeState(
              taskId,
              'error',
              errorMessage,
            );
            this.emitRuntimeStateChanged(
              taskId,
              sessionId,
              this.ports.runtimeService.getTask(taskId).activeTurnId,
              'error',
              errorMessage,
            );
          }
          this.emitError(taskId, sessionId, errorMessage);
        }
      },
    );
    this.unsubscribeBySession.set(sessionId, unsubscribe);
  }
}
