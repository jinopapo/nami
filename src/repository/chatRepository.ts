import type {
  AbortTaskInput,
  GetLastSelectedWorkspaceResult,
  ResumeTaskInput,
  SendMessageInput,
  SendMessageResult,
  SelectDirectoryInput,
  SelectDirectoryResult,
  StartTaskInput,
  StartTaskResult,
  TaskEvent,
  TaskSummary,
} from '../../core/chat';
import type { UiTask } from '../model/chat';

const getChatApi = () => {
  if (!window.nami?.chat) {
    throw new Error('Electron preload bridge is unavailable.');
  }

  return window.nami.chat;
};

const toUiTask = (task: TaskSummary): UiTask => ({
  taskId: task.taskId,
  sessionId: task.sessionId,
  cwd: task.cwd,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  mode: task.mode,
  state: task.state,
});

export const chatRepository = {
  startTask: (input: StartTaskInput): Promise<StartTaskResult> => getChatApi().startTask(input),
  sendMessage: (input: SendMessageInput): Promise<SendMessageResult> => getChatApi().sendMessage(input),
  abortTask: (input: AbortTaskInput): Promise<void> => getChatApi().abortTask(input),
  resumeTask: (input: ResumeTaskInput): Promise<void> => getChatApi().resumeTask(input),
  selectDirectory: (input?: SelectDirectoryInput): Promise<SelectDirectoryResult> => getChatApi().selectDirectory(input),
  getLastSelectedWorkspace: (): Promise<GetLastSelectedWorkspaceResult> => getChatApi().getLastSelectedWorkspace(),
  subscribeEvents: (listener: (event: TaskEvent) => void): (() => void) => getChatApi().subscribeEvents(listener),
  toUiTask,
};
