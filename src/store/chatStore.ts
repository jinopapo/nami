import { create } from 'zustand';
import type { UiEvent, UiTask } from '../model/chat';

const resolveSelectedTaskId = (tasks: UiTask[], selectedTaskId?: string) => {
  if (selectedTaskId && tasks.some((task) => task.taskId === selectedTaskId)) {
    return selectedTaskId;
  }

  return tasks[0]?.taskId;
};

type ChatState = {
  tasks: UiTask[];
  selectedTaskId?: string;
  eventsByTask: Record<string, UiEvent[]>;
  draft: string;
  cwd: string;
  sending: boolean;
  bootError: string | null;
  setTasks: (tasks: UiTask[]) => void;
  upsertTask: (task: UiTask) => void;
  appendEvent: (taskId: string, event: UiEvent) => void;
  selectTask: (taskId: string) => void;
  setDraft: (draft: string) => void;
  setCwd: (cwd: string) => void;
  setSending: (sending: boolean) => void;
  setBootError: (bootError: string | null) => void;
};

export const useChatStore = create<ChatState>((set) => ({
  tasks: [],
  selectedTaskId: undefined,
  eventsByTask: {},
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
      return {
        tasks,
        selectedTaskId: state.selectedTaskId === task.taskId
          ? task.taskId
          : state.selectedTaskId ?? task.taskId,
        cwd: state.cwd || task.cwd,
      };
    }),
  appendEvent: (taskId, event) =>
    set((state) => ({
      eventsByTask: {
        ...state.eventsByTask,
        [taskId]: [...(state.eventsByTask[taskId] ?? []), event],
      },
    })),
  selectTask: (taskId) => set({ selectedTaskId: taskId }),
  setDraft: (draft) => set({ draft }),
  setCwd: (cwd) => set({ cwd }),
  setSending: (sending) => set({ sending }),
  setBootError: (bootError) => set({ bootError }),
}));

export { resolveSelectedTaskId };
