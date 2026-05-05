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
  GetAutoApprovalConfigInput,
  GetAutoApprovalConfigResult,
  GetCurrentBranchInput,
  GetCurrentBranchResult,
  GetAutoCheckConfigInput,
  GetAutoCheckConfigResult,
  GetReviewDiffInput,
  GetReviewDiffResult,
  RunAutoCheckInput,
  RunAutoCheckResult,
  SaveAutoApprovalConfigInput,
  SaveAutoCheckConfigInput,
  CreateTaskInput,
  CreateTaskResult,
  SelectDirectoryInput,
  TaskEvent,
  TransitionTaskLifecycleInput,
  UpdateTaskDependenciesInput,
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
        updateDependencies(input: UpdateTaskDependenciesInput): Promise<void>;
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
        getAutoApprovalConfig(
          input: GetAutoApprovalConfigInput,
        ): Promise<GetAutoApprovalConfigResult>;
        saveAutoApprovalConfig(
          input: SaveAutoApprovalConfigInput,
        ): Promise<void>;
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
