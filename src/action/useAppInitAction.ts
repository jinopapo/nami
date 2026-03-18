import { useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { chatService } from '../service/chatService';

export const useAppInitAction = () => {
  const { setSessions, upsertSession, appendEvent, setCwd, bootError, setBootError } = useChatStore();

  useEffect(() => {
    let active = true;

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
        if (!active) {
          return;
        }

        setSessions(nextSessions as never);
        const initialCwd = nextSessions[0]?.cwd ?? useChatStore.getState().cwd;

        if (initialCwd) {
          setCwd(initialCwd);
        }

        if (nextSessions.length > 0 || !initialCwd) {
          setBootError(null);
          return;
        }

        return chatService.createSession({ cwd: initialCwd, title: '' })
          .then((session) => {
            if (!active) {
              return;
            }

            upsertSession(session as never);
            setBootError(null);
          });
      })
      .catch((error: unknown) => {
        if (active) {
          setBootError(error instanceof Error ? error.message : 'Failed to initialize renderer state.');
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [appendEvent, setBootError, setCwd, setSessions, upsertSession]);

  return { bootError };
};
