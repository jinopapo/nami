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
} from '../../core/chat';

const getChatApi = () => {
  if (!window.nami?.chat) {
    throw new Error('Electron preload bridge is unavailable.');
  }

  return window.nami.chat;
};

export const chatRepository = {
  createSession: (input: CreateSessionInput): Promise<ChatSessionSummary> => getChatApi().createSession(input),
  resumeSession: (input: ResumeSessionInput): Promise<ChatSessionSummary> => getChatApi().resumeSession(input),
  sendMessage: (input: SendMessageInput): Promise<void> => getChatApi().sendMessage(input),
  abortTask: (input: AbortTaskInput): Promise<void> => getChatApi().abortTask(input),
  respondToApproval: (input: RespondToApprovalInput): Promise<void> => getChatApi().respondToApproval(input),
  listSessions: (): Promise<ChatSessionSummary[]> => getChatApi().listSessions(),
  selectDirectory: (input?: SelectDirectoryInput): Promise<SelectDirectoryResult> => getChatApi().selectDirectory(input),
  subscribeEvents: (listener: (event: ChatEvent) => void): (() => void) => getChatApi().subscribeEvents(listener),
};
