import type {
  AbortTaskInput,
  ChatEvent,
  ResumeTaskInput,
  SendMessageInput,
  SendMessageResult,
} from '../../core/chat';

const getChatApi = () => {
  if (!window.nami?.chat) {
    throw new Error('Electron preload bridge is unavailable.');
  }

  return window.nami.chat;
};

export const chatRepository = {
  sendMessage: (input: SendMessageInput): Promise<SendMessageResult> => getChatApi().sendMessage(input),
  abortTask: (input: AbortTaskInput): Promise<void> => getChatApi().abortTask(input),
  resumeTask: (input: ResumeTaskInput): Promise<void> => getChatApi().resumeTask(input),
  subscribeEvents: (listener: (event: ChatEvent) => void): (() => void) => getChatApi().subscribeEvents(listener),
};
