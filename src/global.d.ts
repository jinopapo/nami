import type {
  AbortTaskInput,
  ResumeTaskInput,
  SendMessageInput,
  SendMessageResult,
  SelectDirectoryInput,
  SelectDirectoryResult,
  StartTaskInput,
  StartTaskResult,
  TaskEvent,
} from '../core/chat';

declare global {
  interface Window {
    nami?: {
      platform: string;
      homeDir: string;
      chat: {
        startTask(input: StartTaskInput): Promise<StartTaskResult>;
        sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
        abortTask(input: AbortTaskInput): Promise<void>;
        resumeTask(input: ResumeTaskInput): Promise<void>;
        selectDirectory(input?: SelectDirectoryInput): Promise<SelectDirectoryResult>;
        subscribeEvents(listener: (event: TaskEvent) => void): () => void;
      };
    };
  }
}

export {};
