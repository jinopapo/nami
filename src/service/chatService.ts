import { chatRepository } from '../repository/chatRepository';

export const chatService = {
  createSession: chatRepository.createSession,
  sendMessage: chatRepository.sendMessage,
  abortTask: chatRepository.abortTask,
  respondToApproval: chatRepository.respondToApproval,
  listSessions: chatRepository.listSessions,
  selectDirectory: chatRepository.selectDirectory,
  subscribeEvents: chatRepository.subscribeEvents,
};