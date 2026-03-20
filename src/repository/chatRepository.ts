import type {
  AbortTaskInput,
  ResumeTaskInput,
  SelectDirectoryInput,
  SelectDirectoryResult,
  StartTaskInput,
  StartTaskResult,
  TaskEvent,
} from '../../core/chat';

const getChatApi = () => {
  if (!window.nami?.chat) {
    throw new Error('Electron preload bridge is unavailable.');
  }

  return window.nami.chat;
};

export const chatRepository = {
  startTask: (input: StartTaskInput): Promise<StartTaskResult> => getChatApi().startTask(input),
  abortTask: (input: AbortTaskInput): Promise<void> => getChatApi().abortTask(input),
  resumeTask: (input: ResumeTaskInput): Promise<void> => getChatApi().resumeTask(input),
  selectDirectory: (input?: SelectDirectoryInput): Promise<SelectDirectoryResult> => getChatApi().selectDirectory(input),
  subscribeEvents: (listener: (event: TaskEvent) => void): (() => void) => getChatApi().subscribeEvents(listener),
};
