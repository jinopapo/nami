import { useEffect, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { chatService } from '../service/chatService';

export const useAppInitAction = () => {
  const { setSessions, upsertSession, appendEvent, setCwd, bootError, setBootError } = useChatStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) {
      return;
    }

    if (!window.nami?.chat) {
      setBootError('Electron preload bridge is unavailable. Check preload loading in the main process.');
      return;
    }

    const unsubscribe = chatService.subscribeEvents((event) => {
      if (event.type === 'session') {
        upsertSession(event.session as never);
      }

      if (event.sessionId) {
        appendEvent(event.sessionId, event as never);
      }
    });

    void chatService.listSessions()
      .then((nextSessions) => {
        setSessions(nextSessions as never);
        if (nextSessions[0]?.cwd) {
          setCwd(nextSessions[0].cwd);
        }
        setBootError(null);
        setInitialized(true);
      })
      .catch((error: unknown) => {
        setBootError(error instanceof Error ? error.message : 'Failed to initialize renderer state.');
      });

    return unsubscribe;
  }, [appendEvent, initialized, setBootError, setCwd, setSessions, upsertSession]);

  return { bootError };
};