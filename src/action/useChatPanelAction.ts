import { useMemo } from 'react';
import { useChatStore } from '../store/chatStore';
import { chatService } from '../service/chatService';

export const useChatPanelAction = () => {
  const {
    sessions,
    selectedSessionId,
    eventsBySession,
    draft,
    sending,
    setDraft,
    setSending,
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
    draft,
    sending,
    setDraft,
    handleSend,
    handleApproval,
    handleAbort,
  };
};