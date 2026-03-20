import { chatRepository } from '../repository/chatRepository';

export const chatService = {
  startTask: chatRepository.startTask,
  abortTask: chatRepository.abortTask,
  resumeTask: chatRepository.resumeTask,
  selectDirectory: chatRepository.selectDirectory,
  subscribeEvents: chatRepository.subscribeEvents,
};