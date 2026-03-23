import { useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { chatService } from '../service/chatService';

export const useAppInitAction = () => {
  const { upsertTask, updateTaskState, applyUiEvent, bootError, setBootError } = useChatStore();

  useEffect(() => {
    let active = true;

    if (!window.nami?.chat) {
      setBootError('Electron preload bridge is unavailable. Check preload loading in the main process.');
      return;
    }

    const unsubscribe = chatService.subscribeEvents((event) => {
      if (event.type === 'taskStarted') {
        upsertTask(chatService.toUiTask(event.task));
      }

      if (event.type === 'taskStateChanged') {
        updateTaskState({ taskId: event.taskId, state: event.state, updatedAt: event.timestamp });
      }

      if ('taskId' in event && typeof event.taskId === 'string') {
        const uiEvent = chatService.toUiEvent(event);
        if (uiEvent) {
          applyUiEvent(event.taskId, uiEvent);
        }
      }
    });

    if (useChatStore.getState().cwd) {
      setBootError(null);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, [applyUiEvent, setBootError, updateTaskState, upsertTask]);

  return { bootError };
};
