import { create } from 'zustand';
import type { UiActivity, UiChatMessage, UiChatSession, UiEvent, UiTask } from '../model/chat';

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
  draft: string;
  cwd: string;
  sending: boolean;
  bootError: string | null;
  setTasks: (tasks: UiTask[]) => void;
  upsertTask: (task: UiTask) => void;
  beginOptimisticSession: (input: { prompt: string }) => string;
  promoteOptimisticSession: (temporaryTaskId: string, input: { taskId: string; sessionId: string }) => void;
  applyUiEvent: (taskId: string, event: UiEvent) => void;
  selectTask: (taskId: string) => void;
  setDraft: (draft: string) => void;
  setCwd: (cwd: string) => void;
  setSending: (sending: boolean) => void;
  setBootError: (bootError: string | null) => void;
};

const createSession = (taskId: string, sessionId?: string): UiChatSession => ({
  taskId,
  sessionId,
  phase: 'idle',
  messages: [],
  activities: [],
});

const upsertActivity = (activities: UiActivity[], nextActivity: UiActivity): UiActivity[] => {
  if (nextActivity.type === 'toolCall' && nextActivity.toolCallId) {
    const index = activities.findIndex((activity) => activity.type === 'toolCall' && activity.toolCallId === nextActivity.toolCallId);
    if (index >= 0) {
      const clone = [...activities];
      clone[index] = nextActivity;
      return clone;
    }
  }

  return [...activities, nextActivity];
};

const closeStreamingAssistantMessage = (messages: UiChatMessage[]): UiChatMessage[] => {
  const index = [...messages].reverse().findIndex((message) => message.role === 'assistant' && message.status === 'streaming');
  if (index < 0) {
    return messages;
  }

  const targetIndex = messages.length - 1 - index;
  const clone = [...messages];
  clone[targetIndex] = { ...clone[targetIndex], status: 'sent' };
  return clone;
};

export const useChatStore = create<ChatState>((set) => ({
  tasks: [],
  selectedTaskId: undefined,
  sessionsByTask: {},
  draft: '',
  cwd: '',
  sending: false,
  bootError: null,
  setTasks: (tasks) =>
    set((state) => ({
      tasks,
      selectedTaskId: resolveSelectedTaskId(tasks, state.selectedTaskId),
      cwd: state.cwd || tasks[0]?.cwd || '',
    })),
  upsertTask: (task) =>
    set((state) => {
      const tasks = state.tasks.filter((item) => item.taskId !== task.taskId);
      tasks.unshift(task);
      const existingSession = state.sessionsByTask[task.taskId] ?? createSession(task.taskId, task.sessionId);
      return {
        tasks,
        sessionsByTask: {
          ...state.sessionsByTask,
          [task.taskId]: {
            ...existingSession,
            taskId: task.taskId,
            sessionId: task.sessionId,
            phase: existingSession.phase === 'idle' ? task.state : existingSession.phase,
          },
        },
        selectedTaskId: state.selectedTaskId === task.taskId
          ? task.taskId
          : state.selectedTaskId ?? task.taskId,
        cwd: state.cwd || task.cwd,
      };
    }),
  beginOptimisticSession: ({ prompt }) => {
    const temporaryTaskId = `pending-${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();
    set((state) => ({
      sessionsByTask: {
        ...state.sessionsByTask,
        [temporaryTaskId]: {
          taskId: temporaryTaskId,
          phase: 'submitting',
          messages: [{
            id: `user-${temporaryTaskId}`,
            taskId: temporaryTaskId,
            timestamp,
            role: 'user',
            text: prompt,
            status: 'sent',
          }],
          activities: [],
        },
      },
      selectedTaskId: temporaryTaskId,
    }));
    return temporaryTaskId;
  },
  promoteOptimisticSession: (temporaryTaskId, input) =>
    set((state) => {
      const temporarySession = state.sessionsByTask[temporaryTaskId];
      const existingRealSession = state.sessionsByTask[input.taskId];
      const nextSession: UiChatSession = {
        ...(existingRealSession ?? createSession(input.taskId, input.sessionId)),
        ...(temporarySession ?? {}),
        taskId: input.taskId,
        sessionId: input.sessionId,
        phase: existingRealSession?.phase ?? temporarySession?.phase ?? 'submitting',
        messages: (temporarySession?.messages ?? existingRealSession?.messages ?? []).map((message) => ({
          ...message,
          taskId: input.taskId,
          sessionId: input.sessionId,
        })),
        activities: existingRealSession?.activities ?? temporarySession?.activities ?? [],
      };

      const sessionsByTask = { ...state.sessionsByTask, [input.taskId]: nextSession };
      delete sessionsByTask[temporaryTaskId];

      return {
        sessionsByTask,
        selectedTaskId: state.selectedTaskId === temporaryTaskId ? input.taskId : state.selectedTaskId,
      };
    }),
  applyUiEvent: (taskId, event) =>
    set((state) => {
      const currentSession = state.sessionsByTask[taskId] ?? createSession(taskId, 'sessionId' in event ? event.sessionId : undefined);
      let nextSession: UiChatSession = currentSession;

      if (event.type === 'message') {
        const lastMessage = currentSession.messages.at(-1);
        const messages = lastMessage && lastMessage.role === 'assistant' && lastMessage.status === 'streaming'
          ? [
            ...currentSession.messages.slice(0, -1),
            { ...lastMessage, text: `${lastMessage.text}${event.text}`, timestamp: event.timestamp },
          ]
          : [
            ...currentSession.messages,
            {
              id: `assistant-${event.timestamp}`,
              taskId,
              sessionId: event.sessionId,
              timestamp: event.timestamp,
              role: 'assistant',
              text: event.text,
              status: 'streaming',
            },
          ];

        nextSession = {
          ...currentSession,
          sessionId: event.sessionId,
          phase: currentSession.phase === 'submitting' ? 'running' : currentSession.phase,
          messages,
        };
      } else if (event.type === 'assistantMessageCompleted') {
        nextSession = {
          ...currentSession,
          sessionId: event.sessionId,
          messages: closeStreamingAssistantMessage(currentSession.messages),
        };
      } else {
        const activities = upsertActivity(currentSession.activities, event as UiActivity);
        const phase = event.type === 'taskStateChanged'
          ? event.state
          : event.type === 'permissionRequest'
            ? 'waiting_permission'
            : event.type === 'humanDecisionRequest'
              ? 'waiting_human_decision'
              : currentSession.phase === 'submitting'
                ? 'running'
                : currentSession.phase;

        nextSession = {
          ...currentSession,
          sessionId: 'sessionId' in event ? event.sessionId : currentSession.sessionId,
          phase,
          activities,
        };
      }

      return {
        sessionsByTask: {
          ...state.sessionsByTask,
          [taskId]: nextSession,
        },
      };
    }),
  selectTask: (taskId) => set({ selectedTaskId: taskId }),
  setDraft: (draft) => set({ draft }),
  setCwd: (cwd) => set({ cwd }),
  setSending: (sending) => set({ sending }),
  setBootError: (bootError) => set({ bootError }),
}));

export { resolveSelectedTaskId };
