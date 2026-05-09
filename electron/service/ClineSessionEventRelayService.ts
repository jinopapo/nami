import type { ClineSessionEvents, SessionUpdate } from 'cline';
import type { TaskRuntime } from '../entity/clineSession.js';

type ChatRuntimeState = TaskRuntime['runtimeState'];

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

type ACPEventName =
  | 'user_message_chunk'
  | 'agent_message_chunk'
  | 'agent_thought_chunk'
  | 'tool_call'
  | 'tool_call_update'
  | 'plan'
  | 'available_commands_update'
  | 'current_mode_update'
  | 'config_option_update'
  | 'session_info_update';

type SessionEventServicePort = {
  attachSessionListenersOnce(input: {
    sessionId: string;
    emitter: {
      on: <K extends keyof ClineSessionEvents>(
        name: K,
        listener: ClineSessionEvents[K],
      ) => unknown;
    };
    onSessionUpdate: (name: ACPEventName, update: SessionUpdate) => void;
    onError: (error: Error) => void;
  }): void;
};

type AgentServicePort = {
  emitterForSession(sessionId: string): {
    on: <K extends keyof ClineSessionEvents>(
      name: K,
      listener: ClineSessionEvents[K],
    ) => unknown;
  };
};

type ToolCallSessionUpdate = Extract<
  SessionUpdate,
  { sessionUpdate: 'tool_call' | 'tool_call_update' }
>;

export class ClineSessionEventRelayService {
  constructor(
    private readonly ports: {
      emit: (event: unknown) => void;
      runtimeService: RuntimeServicePort;
      sessionEventService: SessionEventServicePort;
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

  attachSessionListenersOnce(sessionId: string): void {
    this.ports.sessionEventService.attachSessionListenersOnce({
      sessionId,
      emitter: this.ports.agentService.emitterForSession(sessionId),
      onSessionUpdate: (name, update) => {
        const taskId = this.ports.runtimeService.findTaskIdBySession(sessionId);
        if (!taskId) {
          return;
        }
        if (name === 'current_mode_update') {
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
      },
      onError: (error) => {
        const taskId = this.ports.runtimeService.findTaskIdBySession(sessionId);
        if (taskId) {
          this.ports.runtimeService.updateRuntimeState(
            taskId,
            'error',
            error.message,
          );
          this.emitRuntimeStateChanged(
            taskId,
            sessionId,
            this.ports.runtimeService.getTask(taskId).activeTurnId,
            'error',
            error.message,
          );
        }
        this.emitError(taskId, sessionId, error.message);
      },
    });
  }
}
