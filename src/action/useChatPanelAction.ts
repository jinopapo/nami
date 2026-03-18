import { useMemo } from 'react';
import { useChatStore } from '../store/chatStore';
import { chatService } from '../service/chatService';
import { getWorkspaceLabel } from '../service/workspaceService';

export const useChatPanelAction = () => {
  const {
    sessions,
    selectedSessionId,
    eventsBySession,
    draft,
    sending,
    cwd,
    bootError,
    setDraft,
    setSending,
    setCwd,
    upsertSession,
    selectSession,
    setBootError,
  } = useChatStore();

  const activeSession = useMemo(
    () => sessions.find((session) => session.sessionId === selectedSessionId),
    [selectedSessionId, sessions],
  );

  const activeEvents = useMemo(
    () => (selectedSessionId ? eventsBySession[selectedSessionId] ?? [] : []),
    [eventsBySession, selectedSessionId],
  );

  const isTaskRunning = useMemo(() => {
    if (sending) {
      return true;
    }

    const lastStatusEvent = [...activeEvents]
      .reverse()
      .find((event) => event.type === 'status' && typeof event.status === 'string');

    return lastStatusEvent?.status === 'processing';
  }, [activeEvents, sending]);

  const workspaceLabel = useMemo(() => getWorkspaceLabel(cwd, window.nami?.homeDir), [cwd]);

  const handleChooseDirectory = async () => {
    try {
      const result = await chatService.selectDirectory({ defaultPath: cwd || activeSession?.cwd });
      if (!result.path) {
        return;
      }

      setCwd(result.path);

      if (sessions.length === 0) {
        const session = await chatService.createSession({ cwd: result.path, title: '' });
        upsertSession(session as never);
        selectSession(session.sessionId);
      }

      setBootError(null);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Failed to choose directory.');
    }
  };

  const handleSend = async () => {
    if (!selectedSessionId || !draft.trim()) {
      return;
    }

    setSending(true);

    try {
      await chatService.sendMessage({ sessionId: selectedSessionId, text: draft });
      setDraft('');
      setBootError(null);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleApproval = async (
    approvalId: string,
    decision: 'approve' | 'reject',
  ) => {
    if (!selectedSessionId) {
      return;
    }

    try {
      await chatService.respondToApproval({ sessionId: selectedSessionId, approvalId, decision });
      setBootError(null);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Failed to respond to approval.');
    }
  };

  const handleAbort = async () => {
    if (!selectedSessionId) {
      return;
    }

    try {
      await chatService.abortTask({ sessionId: selectedSessionId });
      setBootError(null);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Failed to stop task.');
    }
  };

  return {
    selectedSessionId,
    activeSession,
    activeEvents,
    isTaskRunning,
    workspaceLabel,
    bootError,
    draft,
    sending,
    setDraft,
    handleChooseDirectory,
    handleSend,
    handleApproval,
    handleAbort,
  };
};
