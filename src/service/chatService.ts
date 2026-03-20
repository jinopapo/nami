import { chatRepository } from '../repository/chatRepository';
import type { UiEvent, UiTask } from '../model/chat';

const getWaitingState = (task?: UiTask) => {
  if (!task) {
    return undefined;
  }

  if (task.state === 'waiting_permission' || task.state === 'waiting_human_decision') {
    return task.state;
  }

  return undefined;
};

const hasReadableMessage = (event: UiEvent): boolean => event.type === 'message' && event.text.length > 0;

export const chatService = {
  startTask: chatRepository.startTask,
  abortTask: chatRepository.abortTask,
  resumeTask: chatRepository.resumeTask,
  selectDirectory: chatRepository.selectDirectory,
  subscribeEvents: chatRepository.subscribeEvents,
  toUiTask: chatRepository.toUiTask,
  toUiEvent: chatRepository.toUiEvent,
  getWaitingState,
  hasReadableMessage,
};