/* eslint-disable max-lines */
import { create } from 'zustand';
import type { SessionEvent, UiChatSession } from '../model/chat';
import type { UiTask } from '../model/task';

const resolveSelectedTaskId = (tasks: UiTask[], selectedTaskId?: string) => {
  if (selectedTaskId && tasks.some((task) => task.taskId === selectedTaskId)) {
    return selectedTaskId;
  }

  return tasks[0]?.taskId;
};

type ChatState = {
  tasks: UiTask[];
  selectedTaskId?: string;
  sessionsByTask: Record<string, UiChatSession>;
  pendingTaskStateByTask: Record<
    string,
    {
      lifecycleState?: UiTask['lifecycleState'];
      runtimeState?: UiTask['runtimeState'];
      mode?: UiTask['mode'];
      updatedAt?: string;
      projectWorkspacePath?: UiTask['projectWorkspacePath'];
      taskWorkspacePath?: UiTask['taskWorkspacePath'];
      taskBranchName?: UiTask['taskBranchName'];
      baseBranchName?: UiTask['baseBranchName'];
      workspaceStatus?: UiTask['workspaceStatus'];
      mergeStatus?: UiTask['mergeStatus'];
      mergeFailureReason?: UiTask['mergeFailureReason'];
      mergeMessage?: UiTask['mergeMessage'];
      clearMergeFailure?: boolean;
      latestAutoCheckResult?: UiTask['latestAutoCheckResult'];
    }
  >;
  draft: string;
  cwd: string;
  bootError: string | null;
  setTasks: (tasks: UiTask[]) => void;
  upsertTask: (task: UiTask) => void;
  updateTaskState: (input: {
    taskId: string;
    lifecycleState?: UiTask['lifecycleState'];
    runtimeState?: UiTask['runtimeState'];
    mode?: UiTask['mode'];
    updatedAt?: string;
    projectWorkspacePath?: UiTask['projectWorkspacePath'];
    taskWorkspacePath?: UiTask['taskWorkspacePath'];
    taskBranchName?: UiTask['taskBranchName'];
    baseBranchName?: UiTask['baseBranchName'];
    workspaceStatus?: UiTask['workspaceStatus'];
    mergeStatus?: UiTask['mergeStatus'];
    mergeFailureReason?: UiTask['mergeFailureReason'];
    mergeMessage?: UiTask['mergeMessage'];
    clearMergeFailure?: boolean;
    latestAutoCheckResult?: UiTask['latestAutoCheckResult'];
  }) => void;
  beginOptimisticSession: (input: { prompt: string }) => {
    temporaryTaskId: string;
  };
  appendOptimisticUserEvent: (input: {
    taskId: string;
    prompt: string;
  }) => void;
  appendLocalEvent: (taskId: string, event: SessionEvent) => void;
  promoteOptimisticSession: (
    temporaryTaskId: string,
    input: { taskId: string; sessionId: string },
  ) => void;
  discardOptimisticSession: (temporaryTaskId: string) => void;
  applyUiEvent: (taskId: string, event: SessionEvent) => void;
  selectTask: (taskId: string) => void;
  clearSelectedTask: () => void;
  setDraft: (draft: string) => void;
  setCwd: (cwd: string) => void;
  setBootError: (bootError: string | null) => void;
};

const createSession = (taskId: string, sessionId?: string): UiChatSession => ({
  taskId,
  sessionId,
  events: [],
});

const upsertToolCallEvent = (
  events: SessionEvent[],
  nextEvent: SessionEvent,
): SessionEvent[] => {
  if (nextEvent.type === 'toolCall' && nextEvent.toolCallId) {
    const index = events.findIndex(
      (event) =>
        event.type === 'toolCall' && event.toolCallId === nextEvent.toolCallId,
    );
    if (index >= 0) {
      const clone = [...events];
      const previousEvent = clone[index];
      clone[index] =
        previousEvent.type === 'toolCall'
          ? {
              ...previousEvent,
              ...nextEvent,
              rawInput: nextEvent.rawInput ?? previousEvent.rawInput,
              rawOutput: nextEvent.rawOutput ?? previousEvent.rawOutput,
              toolLog: nextEvent.toolLog ?? previousEvent.toolLog,
              content: nextEvent.content ?? previousEvent.content,
              locations: nextEvent.locations ?? previousEvent.locations,
              details: nextEvent.details ?? previousEvent.details,
            }
          : nextEvent;
      return clone;
    }
  }

  return [...events, nextEvent];
};

const upsertConfirmedUserMessageEvent = (
  events: SessionEvent[],
  nextEvent: SessionEvent,
): SessionEvent[] => {
  if (
    nextEvent.type !== 'userMessage' ||
    nextEvent.delivery !== 'confirmed' ||
    !nextEvent.text
  ) {
    return [...events, nextEvent];
  }

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (
      event.type === 'userMessage' &&
      event.delivery === 'optimistic' &&
      event.text === nextEvent.text
    ) {
      const clone = [...events];
      clone[index] = {
        ...event,
        ...nextEvent,
        delivery: 'confirmed',
      };
      return clone;
    }
  }

  return [...events, nextEvent];
};

const upsertSessionEvent = (
  events: SessionEvent[],
  nextEvent: SessionEvent,
): SessionEvent[] => {
  if (nextEvent.type === 'autoCheckStep') {
    const index = events.findIndex(
      (event) =>
        event.type === 'autoCheckStep' &&
        event.step.autoCheckRunId === nextEvent.step.autoCheckRunId &&
        event.step.stepId === nextEvent.step.stepId,
    );
    if (index >= 0) {
      const clone = [...events];
      const previousEvent = clone[index];
      clone[index] =
        previousEvent.type === 'autoCheckStep'
          ? {
              ...previousEvent,
              ...nextEvent,
              step: {
                ...previousEvent.step,
                ...nextEvent.step,
              },
            }
          : nextEvent;
      return clone;
    }
    return [...events, nextEvent];
  }

  if (nextEvent.type === 'toolCall') {
    return upsertToolCallEvent(events, nextEvent);
  }

  return upsertConfirmedUserMessageEvent(events, nextEvent);
};

const createOptimisticUserMessageEvent = (
  taskId: string,
  prompt: string,
  sessionId?: string,
): SessionEvent => ({
  type: 'userMessage',
  role: 'user',
  delivery: 'optimistic',
  taskId,
  sessionId,
  timestamp: new Date().toISOString(),
  text: prompt,
});

export const useChatStore = create<ChatState>((set) => ({
  tasks: [],
  selectedTaskId: undefined,
  sessionsByTask: {},
  pendingTaskStateByTask: {},
  draft: '',
  cwd: '',
  bootError: null,
  setTasks: (tasks) =>
    set((state) => ({
      tasks,
      selectedTaskId: resolveSelectedTaskId(tasks, state.selectedTaskId),
      cwd: state.cwd || tasks[0]?.cwd || '',
    })),
  upsertTask: (task) =>
    set((state) => {
      const pendingState = state.pendingTaskStateByTask[task.taskId];
      const mergedTask = pendingState
        ? {
            ...task,
            lifecycleState: pendingState.lifecycleState ?? task.lifecycleState,
            runtimeState: pendingState.runtimeState ?? task.runtimeState,
            mode: pendingState.mode ?? task.mode,
            updatedAt: pendingState.updatedAt ?? task.updatedAt,
            projectWorkspacePath:
              pendingState.projectWorkspacePath ?? task.projectWorkspacePath,
            taskWorkspacePath:
              pendingState.taskWorkspacePath ?? task.taskWorkspacePath,
            taskBranchName: pendingState.taskBranchName ?? task.taskBranchName,
            baseBranchName: pendingState.baseBranchName ?? task.baseBranchName,
            workspaceStatus:
              pendingState.workspaceStatus ?? task.workspaceStatus,
            mergeStatus: pendingState.mergeStatus ?? task.mergeStatus,
            mergeFailureReason: pendingState.clearMergeFailure
              ? undefined
              : (pendingState.mergeFailureReason ?? task.mergeFailureReason),
            mergeMessage: pendingState.clearMergeFailure
              ? undefined
              : (pendingState.mergeMessage ?? task.mergeMessage),
            latestAutoCheckResult:
              pendingState.latestAutoCheckResult ?? task.latestAutoCheckResult,
          }
        : task;
      const tasks = state.tasks.filter((item) => item.taskId !== task.taskId);
      tasks.unshift(mergedTask);
      const existingSession =
        state.sessionsByTask[task.taskId] ??
        createSession(task.taskId, task.sessionId);
      const pendingTaskStateByTask = { ...state.pendingTaskStateByTask };
      delete pendingTaskStateByTask[task.taskId];
      return {
        tasks,
        sessionsByTask: {
          ...state.sessionsByTask,
          [task.taskId]: {
            ...existingSession,
            taskId: task.taskId,
            sessionId: task.sessionId,
          },
        },
        pendingTaskStateByTask,
        selectedTaskId:
          state.selectedTaskId === task.taskId
            ? task.taskId
            : (state.selectedTaskId ?? task.taskId),
        cwd: state.cwd || task.cwd,
      };
    }),
  updateTaskState: ({
    taskId,
    lifecycleState,
    runtimeState,
    mode,
    updatedAt,
    projectWorkspacePath,
    taskWorkspacePath,
    taskBranchName,
    baseBranchName,
    workspaceStatus,
    mergeStatus,
    mergeFailureReason,
    mergeMessage,
    clearMergeFailure,
    latestAutoCheckResult,
  }) =>
    set((current) => {
      const hasTask = current.tasks.some((task) => task.taskId === taskId);
      if (!hasTask) {
        return {
          pendingTaskStateByTask: {
            ...current.pendingTaskStateByTask,
            [taskId]: {
              ...current.pendingTaskStateByTask[taskId],
              lifecycleState,
              runtimeState,
              mode,
              projectWorkspacePath:
                projectWorkspacePath ??
                current.pendingTaskStateByTask[taskId]?.projectWorkspacePath,
              taskWorkspacePath:
                taskWorkspacePath ??
                current.pendingTaskStateByTask[taskId]?.taskWorkspacePath,
              taskBranchName:
                taskBranchName ??
                current.pendingTaskStateByTask[taskId]?.taskBranchName,
              baseBranchName:
                baseBranchName ??
                current.pendingTaskStateByTask[taskId]?.baseBranchName,
              workspaceStatus:
                workspaceStatus ??
                current.pendingTaskStateByTask[taskId]?.workspaceStatus,
              mergeStatus:
                mergeStatus ??
                current.pendingTaskStateByTask[taskId]?.mergeStatus,
              mergeFailureReason: clearMergeFailure
                ? undefined
                : (mergeFailureReason ??
                  current.pendingTaskStateByTask[taskId]?.mergeFailureReason),
              mergeMessage: clearMergeFailure
                ? undefined
                : (mergeMessage ??
                  current.pendingTaskStateByTask[taskId]?.mergeMessage),
              clearMergeFailure:
                clearMergeFailure ??
                current.pendingTaskStateByTask[taskId]?.clearMergeFailure,
              updatedAt:
                updatedAt ??
                current.pendingTaskStateByTask[taskId]?.updatedAt ??
                new Date().toISOString(),
              latestAutoCheckResult:
                latestAutoCheckResult ??
                current.pendingTaskStateByTask[taskId]?.latestAutoCheckResult,
            },
          },
        };
      }

      return {
        tasks: current.tasks.map((task) =>
          task.taskId === taskId
            ? {
                ...task,
                lifecycleState: lifecycleState ?? task.lifecycleState,
                runtimeState: runtimeState ?? task.runtimeState,
                mode: mode ?? task.mode,
                projectWorkspacePath:
                  projectWorkspacePath ?? task.projectWorkspacePath,
                taskWorkspacePath: taskWorkspacePath ?? task.taskWorkspacePath,
                taskBranchName: taskBranchName ?? task.taskBranchName,
                baseBranchName: baseBranchName ?? task.baseBranchName,
                workspaceStatus: workspaceStatus ?? task.workspaceStatus,
                mergeStatus: mergeStatus ?? task.mergeStatus,
                mergeFailureReason: clearMergeFailure
                  ? undefined
                  : (mergeFailureReason ?? task.mergeFailureReason),
                mergeMessage: clearMergeFailure
                  ? undefined
                  : (mergeMessage ?? task.mergeMessage),
                updatedAt: updatedAt ?? new Date().toISOString(),
                latestAutoCheckResult:
                  latestAutoCheckResult ?? task.latestAutoCheckResult,
              }
            : task,
        ),
      };
    }),
  beginOptimisticSession: ({ prompt }) => {
    const temporaryTaskId = `pending-${crypto.randomUUID()}`;
    const userEvent = createOptimisticUserMessageEvent(temporaryTaskId, prompt);
    set((state) => ({
      sessionsByTask: {
        ...state.sessionsByTask,
        [temporaryTaskId]: {
          taskId: temporaryTaskId,
          events: [userEvent],
        },
      },
      selectedTaskId: temporaryTaskId,
    }));
    return { temporaryTaskId };
  },
  appendOptimisticUserEvent: ({ taskId, prompt }) => {
    set((state) => {
      const currentSession =
        state.sessionsByTask[taskId] ?? createSession(taskId);
      return {
        sessionsByTask: {
          ...state.sessionsByTask,
          [taskId]: {
            ...currentSession,
            events: [
              ...currentSession.events,
              createOptimisticUserMessageEvent(
                taskId,
                prompt,
                currentSession.sessionId,
              ),
            ],
          },
        },
      };
    });
  },
  appendLocalEvent: (taskId, event) =>
    set((state) => {
      const currentSession =
        state.sessionsByTask[taskId] ?? createSession(taskId, event.sessionId);
      return {
        sessionsByTask: {
          ...state.sessionsByTask,
          [taskId]: {
            ...currentSession,
            sessionId: currentSession.sessionId ?? event.sessionId,
            events: [...currentSession.events, event],
          },
        },
      };
    }),
  promoteOptimisticSession: (temporaryTaskId, input) =>
    set((state) => {
      const temporarySession = state.sessionsByTask[temporaryTaskId];
      const existingRealSession = state.sessionsByTask[input.taskId];
      const nextSession: UiChatSession = {
        ...(existingRealSession ??
          createSession(input.taskId, input.sessionId)),
        ...(temporarySession ?? {}),
        taskId: input.taskId,
        sessionId: input.sessionId,
        events: (
          temporarySession?.events ??
          existingRealSession?.events ??
          []
        ).map((event) => ({
          ...event,
          taskId: input.taskId,
          sessionId: input.sessionId,
        })),
      };

      const sessionsByTask = {
        ...state.sessionsByTask,
        [input.taskId]: nextSession,
      };
      delete sessionsByTask[temporaryTaskId];

      return {
        sessionsByTask,
        selectedTaskId:
          state.selectedTaskId === temporaryTaskId
            ? input.taskId
            : state.selectedTaskId,
      };
    }),
  discardOptimisticSession: (temporaryTaskId) =>
    set((state) => {
      const sessionsByTask = { ...state.sessionsByTask };
      delete sessionsByTask[temporaryTaskId];

      return {
        sessionsByTask,
        selectedTaskId:
          state.selectedTaskId === temporaryTaskId
            ? undefined
            : state.selectedTaskId,
      };
    }),
  applyUiEvent: (taskId, event) =>
    set((state) => {
      const currentSession =
        state.sessionsByTask[taskId] ?? createSession(taskId, event.sessionId);
      const nextSession: UiChatSession = {
        ...currentSession,
        sessionId: currentSession.sessionId ?? event.sessionId,
        events: upsertSessionEvent(currentSession.events, event),
      };

      return {
        sessionsByTask: {
          ...state.sessionsByTask,
          [taskId]: nextSession,
        },
      };
    }),
  selectTask: (taskId) => set({ selectedTaskId: taskId }),
  clearSelectedTask: () => set({ selectedTaskId: undefined }),
  setDraft: (draft) => set({ draft }),
  setCwd: (cwd) => set({ cwd }),
  setBootError: (bootError) => set({ bootError }),
}));

export { resolveSelectedTaskId };
