/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_service' */
import { describe, expect, it, vi } from 'vitest';
import type {
  SessionEvent,
  TaskRuntime,
  ToolCallSessionUpdate,
} from '../entity/clineSession.js';
import { ClineSessionEventRelayService } from './ClineSessionEventRelayService.js';

type SessionUpdate = Extract<
  SessionEvent,
  { type: 'session-update' }
>['update'];

const createTask = (): TaskRuntime => ({
  taskId: 'task-1',
  sessionId: 'session-1',
  cwd: '/tmp/project',
  projectWorkspacePath: '/tmp/project',
  taskWorkspacePath: '/tmp/project/.worktree/task-1',
  taskBranchName: 'task/task-1',
  taskBranchManagement: 'system_managed',
  baseBranchName: 'main',
  reviewMergePolicy: 'merge_to_base',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  mode: 'act',
  lifecycleState: 'executing',
  runtimeState: 'running',
  workspaceStatus: 'ready',
  mergeStatus: 'idle',
  dependencyTaskIds: [],
  pendingDependencyTaskIds: [],
  initialPrompt: 'Implement feature',
  activeTurnId: 'turn-1',
  turns: [],
});

const isToolCallSessionUpdate = (
  update: SessionUpdate,
): update is ToolCallSessionUpdate =>
  typeof update === 'object' &&
  update !== null &&
  'sessionUpdate' in update &&
  (update.sessionUpdate === 'tool_call' ||
    update.sessionUpdate === 'tool_call_update');

describe('ClineSessionEventRelayService', () => {
  it('relays detailed session ended error to runtime state and emitted error', () => {
    const task = createTask();
    const emittedEvents: unknown[] = [];
    let sessionListener: ((event: SessionEvent) => void) | undefined;
    const updateRuntimeState = vi.fn(
      (
        _taskId: string,
        state: TaskRuntime['runtimeState'],
        _reason?: string,
      ) => ({
        ...task,
        runtimeState: state,
      }),
    );
    const service = new ClineSessionEventRelayService({
      emit: (event) => emittedEvents.push(event),
      runtimeService: {
        getTask: vi.fn(() => task),
        findTaskIdBySession: vi.fn(() => task.taskId),
        updateRuntimeState,
      },
      agentService: {
        subscribeSession: vi.fn((_sessionId, listener) => {
          sessionListener = listener;
          return vi.fn();
        }),
      },
      syncTaskModeWithLifecycle: vi.fn(),
      logToolCall: vi.fn(async () => undefined),
      isToolCallSessionUpdate,
      toWorkspaceEventPayload: vi.fn(() => ({})),
    });

    service.attachSessionListenersOnce(task.sessionId);
    if (!sessionListener) {
      throw new Error('session listener was not registered');
    }

    sessionListener({
      type: 'session-ended',
      stopReason: 'error',
      error: 'provider authentication failed',
    });

    expect(updateRuntimeState).toHaveBeenCalledWith(
      task.taskId,
      'error',
      'provider authentication failed',
    );
    expect(emittedEvents).toContainEqual({
      type: 'chat-runtime-state-changed',
      taskId: task.taskId,
      sessionId: task.sessionId,
      turnId: task.activeTurnId,
      state: 'error',
      reason: 'provider authentication failed',
    });
    expect(emittedEvents).toContainEqual({
      type: 'error',
      taskId: task.taskId,
      sessionId: task.sessionId,
      message: 'provider authentication failed',
    });
  });

  it('does not subscribe twice for the same session id', () => {
    const task = createTask();
    const emittedEvents: unknown[] = [];
    const sessionListeners: Array<(event: SessionEvent) => void> = [];
    const logToolCall = vi.fn(async () => undefined);
    const subscribeSession = vi.fn((_sessionId, listener) => {
      sessionListeners.push(listener);
      return vi.fn();
    });
    const service = new ClineSessionEventRelayService({
      emit: (event) => emittedEvents.push(event),
      runtimeService: {
        getTask: vi.fn(() => task),
        findTaskIdBySession: vi.fn(() => task.taskId),
        updateRuntimeState: vi.fn(() => task),
      },
      agentService: {
        subscribeSession,
      },
      syncTaskModeWithLifecycle: vi.fn(),
      logToolCall,
      isToolCallSessionUpdate,
      toWorkspaceEventPayload: vi.fn(() => ({})),
    });

    service.attachSessionListenersOnce(task.sessionId);
    service.attachSessionListenersOnce(task.sessionId);

    expect(subscribeSession).toHaveBeenCalledTimes(1);
    expect(sessionListeners).toHaveLength(1);

    const [sessionListener] = sessionListeners;
    if (!sessionListener) {
      throw new Error('session listener was not registered');
    }
    const update: ToolCallSessionUpdate = {
      sessionUpdate: 'tool_call',
      toolCallId: 'tool-1',
    };

    sessionListener({
      type: 'session-update',
      update,
    });

    expect(logToolCall).toHaveBeenCalledTimes(1);
    expect(emittedEvents).toEqual([
      {
        type: 'session-update',
        taskId: task.taskId,
        sessionId: task.sessionId,
        turnId: task.activeTurnId,
        update,
      },
    ]);
  });
});
