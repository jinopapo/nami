import { useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { chatService } from '../service/chatService';

export const useAppInitAction = () => {
  const { upsertTask, appendEvent, setCwd, bootError, setBootError } = useChatStore();

  useEffect(() => {
    let active = true;

    if (!window.nami?.chat) {
      setBootError('Electron preload bridge is unavailable. Check preload loading in the main process.');
      return;
    }

    const unsubscribe = chatService.subscribeEvents((event) => {
      if (event.type === 'taskStarted') {
        upsertTask(event.task as never);
      }

      if ('taskId' in event && typeof event.taskId === 'string') {
        appendEvent(event.taskId, event as never);
      }
    });

    if (useChatStore.getState().cwd) {
      setBootError(null);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, [appendEvent, setBootError, setCwd, upsertTask]);

  return { bootError };
};
