import { create } from 'zustand';
import type { UiActivity, UiChatMessage, UiChatSession, UiEvent, UiTask, UiTurn } from '../model/chat';

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
  beginOptimisticSession: (input: { prompt: string }) => { temporaryTaskId: string; turnId: string };
  appendOptimisticTurn: (input: { taskId: string; prompt: string }) => { turnId: string };
  promoteOptimisticSession: (temporaryTaskId: string, input: { taskId: string; sessionId: string; turnId: string }) => void;
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
  messages: [],
  activities: [],
  turns: [],
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

const createOptimisticUserMessage = (taskId: string, prompt: string, turnId: string, sessionId?: string): UiChatMessage => ({
  id: `user-${turnId}`,
  taskId,
  sessionId,
  turnId,
  timestamp: new Date().toISOString(),
  role: 'user',
  text: prompt,
  status: 'sent',
});

const createTurn = (taskId: string, turnId: string, userMessageId: string, sessionId?: string): UiTurn => ({
  turnId,
  taskId,
  sessionId,
  userMessageId,
  state: 'submitting',
  startedAt: new Date().toISOString(),
});

const upsertTurn = (turns: UiTurn[], turnId: string, updater: (turn: UiTurn) => UiTurn): UiTurn[] => {
  const index = turns.findIndex((turn) => turn.turnId === turnId);
  if (index < 0) {
    return turns;
  }
  const clone = [...turns];
  clone[index] = updater(clone[index]);
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
            turns: existingSession.turns,
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
    const turnId = crypto.randomUUID();
    const userMessage = createOptimisticUserMessage(temporaryTaskId, prompt, turnId);
    const turn = createTurn(temporaryTaskId, turnId, userMessage.id);
    set((state) => ({
      sessionsByTask: {
        ...state.sessionsByTask,
        [temporaryTaskId]: {
          taskId: temporaryTaskId,
          messages: [userMessage],
          activities: [],
          turns: [turn],
        },
      },
      selectedTaskId: temporaryTaskId,
    }));
    return { temporaryTaskId, turnId };
  },
  appendOptimisticTurn: ({ taskId, prompt }) => {
    const turnId = crypto.randomUUID();
    set((state) => {
      const currentSession = state.sessionsByTask[taskId] ?? createSession(taskId);
      const userMessage = createOptimisticUserMessage(taskId, prompt, turnId, currentSession.sessionId);
      const turn = createTurn(taskId, turnId, userMessage.id, currentSession.sessionId);
      return {
        sessionsByTask: {
          ...state.sessionsByTask,
          [taskId]: {
            ...currentSession,
            messages: [...currentSession.messages, userMessage],
            turns: [...currentSession.turns, turn],
          },
        },
      };
    });
    return { turnId };
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
        messages: (temporarySession?.messages ?? existingRealSession?.messages ?? []).map((message) => ({
          ...message,
          taskId: input.taskId,
          sessionId: input.sessionId,
        })),
        activities: existingRealSession?.activities ?? temporarySession?.activities ?? [],
        turns: (temporarySession?.turns ?? existingRealSession?.turns ?? []).map((turn) => ({
          ...turn,
          taskId: input.taskId,
          sessionId: input.sessionId,
          turnId: turn.turnId === input.turnId || turn.taskId === temporaryTaskId ? input.turnId : turn.turnId,
        })),
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
        const targetTurnId = event.turnId;
        const targetTurn = targetTurnId ? currentSession.turns.find((turn) => turn.turnId === targetTurnId) : undefined;
        const assistantMessageIndex = targetTurn?.assistantMessageId
          ? currentSession.messages.findIndex((message) => message.id === targetTurn.assistantMessageId)
          : !targetTurnId
            ? currentSession.messages.findIndex((message, index, array) => {
              const reversedIndex = array.length - 1 - index;
              const reversedMessage = array[array.length - 1 - reversedIndex];
              return reversedMessage.role === 'assistant' && reversedMessage.status === 'streaming';
            })
            : -1;
        let messages = currentSession.messages;
        let turns = currentSession.turns;

        if (assistantMessageIndex >= 0) {
          const currentMessage = currentSession.messages[assistantMessageIndex];
          messages = [...currentSession.messages];
          messages[assistantMessageIndex] = {
            ...currentMessage,
            text: `${currentMessage.text}${event.text}`,
            timestamp: event.timestamp,
            status: 'streaming',
          };
        } else {
          const assistantMessageId = `assistant-${targetTurnId ?? event.timestamp}`;
          messages = [
            ...currentSession.messages,
            {
              id: assistantMessageId,
              taskId,
              sessionId: event.sessionId,
              turnId: targetTurnId,
              timestamp: event.timestamp,
              role: 'assistant',
              text: event.text,
              status: 'streaming',
            },
          ];
          if (targetTurnId) {
            turns = upsertTurn(currentSession.turns, targetTurnId, (turn) => ({
              ...turn,
              assistantMessageId,
              state: turn.state === 'submitting' ? 'running' : turn.state,
            }));
          }
        }

        nextSession = {
          ...currentSession,
          sessionId: event.sessionId,
          messages,
          turns,
        };
      } else if (event.type === 'assistantMessageCompleted') {
        const turns = upsertTurn(currentSession.turns, event.turnId, (turn) => ({
          ...turn,
          state: turn.state === 'error' ? turn.state : 'completed',
          endedAt: event.timestamp,
          reason: event.reason,
        }));
        nextSession = {
          ...currentSession,
          sessionId: event.sessionId,
          messages: currentSession.messages.map((message, index, array) => {
            if (event.turnId) {
              return message.turnId === event.turnId && message.role === 'assistant'
                ? { ...message, status: 'sent' }
                : message;
            }

            const isLastStreamingAssistant = message.role === 'assistant'
              && message.status === 'streaming'
              && index === array.map((item) => item.role === 'assistant' && item.status === 'streaming').lastIndexOf(true);

            return isLastStreamingAssistant ? { ...message, status: 'sent' } : message;
          }),
          turns,
        };
      } else {
        const activities = upsertActivity(currentSession.activities, event as UiActivity);
        const nextState: UiTurn['state'] | undefined = event.type === 'taskStateChanged'
          ? event.state
          : event.type === 'permissionRequest'
            ? 'waiting_permission'
            : event.type === 'humanDecisionRequest'
              ? 'waiting_human_decision'
              : undefined;

        nextSession = {
          ...currentSession,
          sessionId: 'sessionId' in event ? event.sessionId : currentSession.sessionId,
          activities,
          turns: event.turnId && nextState
            ? upsertTurn(currentSession.turns, event.turnId, (turn) => ({
              ...turn,
              state: nextState,
              endedAt: ['completed', 'aborted', 'error'].includes(nextState) ? event.timestamp : turn.endedAt,
              reason: 'reason' in event ? event.reason : turn.reason,
            }))
            : currentSession.turns,
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
