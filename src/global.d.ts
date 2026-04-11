import type {
  AbortTaskInput,
  ResumeTaskInput,
  SendMessageInput,
  SendMessageResult,
  ChatEvent,
} from '../core/chat';
import type {
  AutoCheckConfig,
  GetCurrentBranchInput,
  GetCurrentBranchResult,
  GetAutoCheckConfigInput,
  GetAutoCheckConfigResult,
  RunAutoCheckInput,
  RunAutoCheckResult,
  SaveAutoCheckConfigInput,
  CreateTaskInput,
  CreateTaskResult,
  SelectDirectoryInput,
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
        selectDirectory(
          input?: SelectDirectoryInput,
        ): Promise<{ path?: string }>;
        getLastSelectedWorkspace(): Promise<{ path?: string }>;
        getCurrentBranch(
          input: GetCurrentBranchInput,
        ): Promise<GetCurrentBranchResult>;
        getAutoCheckConfig(
          input: GetAutoCheckConfigInput,
        ): Promise<GetAutoCheckConfigResult>;
        saveAutoCheckConfig(input: SaveAutoCheckConfigInput): Promise<void>;
        runAutoCheck(input: RunAutoCheckInput): Promise<RunAutoCheckResult>;
        subscribeEvents(listener: (event: TaskEvent) => void): () => void;
      };
    };
  }
}

export {};
