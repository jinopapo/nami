import type {
  AbortTaskInput,
  ChatEvent,
  ChatSessionSummary,
  CreateSessionInput,
  RespondToApprovalInput,
  ResumeSessionInput,
  SelectDirectoryInput,
  SelectDirectoryResult,
  SendMessageInput,
  SendMessageResult,
} from '../core/chat';

declare global {
  interface Window {
    nami?: {
      platform: string;
      homeDir: string;
      chat: {
        createSession(input: CreateSessionInput): Promise<ChatSessionSummary>;
        resumeSession(input: ResumeSessionInput): Promise<ChatSessionSummary>;
        sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
        abortTask(input: AbortTaskInput): Promise<void>;
        respondToApproval(input: RespondToApprovalInput): Promise<void>;
        listSessions(): Promise<ChatSessionSummary[]>;
        selectDirectory(input?: SelectDirectoryInput): Promise<SelectDirectoryResult>;
        subscribeEvents(listener: (event: ChatEvent) => void): () => void;
      };
    };
  }
}

export {};
