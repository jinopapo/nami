import type {
  AbortTaskInput,
  ResumeTaskInput,
  SendMessageInput,
  SendMessageResult,
  ChatEvent,
} from '../share/chat';
import type {
  CommitReviewInput,
  CommitReviewResult,
  GetCurrentBranchInput,
  GetCurrentBranchResult,
  GetAutoCheckConfigInput,
  GetAutoCheckConfigResult,
  GetReviewDiffInput,
  GetReviewDiffResult,
  RunAutoCheckInput,
  RunAutoCheckResult,
  SaveAutoCheckConfigInput,
  CreateTaskInput,
  CreateTaskResult,
  SelectDirectoryInput,
  TaskEvent,
  TransitionTaskLifecycleInput,
} from '../share/task';
import type { GetWindowBootstrapStateResult } from '../share/app';

declare global {
  interface Window {
    nami?: {
      platform: string;
      homeDir: string;
      app: {
        openWindow(): Promise<void>;
        getWindowBootstrapState(): Promise<GetWindowBootstrapStateResult>;
      };
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
        getReviewDiff(input: GetReviewDiffInput): Promise<GetReviewDiffResult>;
        commitReview(input: CommitReviewInput): Promise<CommitReviewResult>;
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
