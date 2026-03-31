import type {
  AbortTaskInput,
  ResumeTaskInput,
  SendMessageInput,
  SendMessageResult,
  ChatEvent,
} from '../core/chat';
import type {
  CreateTaskInput,
  CreateTaskResult,
  GetLastSelectedWorkspaceResult,
  SelectDirectoryInput,
  SelectDirectoryResult,
  TaskEvent,
  TransitionTaskLifecycleInput,
} from '../core/task';

declare global {
  interface Window {
    nami?: {
      platform: string;
      homeDir: string;
      chat: {
        sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
        abortTask(input: AbortTaskInput): Promise<void>;
        resumeTask(input: ResumeTaskInput): Promise<void>;
        subscribeEvents(listener: (event: ChatEvent) => void): () => void;
      };
      task: {
        create(input: CreateTaskInput): Promise<CreateTaskResult>;
        transitionLifecycle(input: TransitionTaskLifecycleInput): Promise<void>;
        selectDirectory(input?: SelectDirectoryInput): Promise<SelectDirectoryResult>;
        getLastSelectedWorkspace(): Promise<GetLastSelectedWorkspaceResult>;
        subscribeEvents(listener: (event: TaskEvent) => void): () => void;
      };
    };
  }
}

export {};
