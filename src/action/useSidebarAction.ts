import { useMemo, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { chatService } from '../service/chatService';
import { getWorkspaceLabel } from '../service/workspaceService';

export const useSidebarAction = () => {
  const { sessions, selectedSessionId, cwd, setCwd, upsertSession, selectSession, bootError, setBootError } = useChatStore();
  const [title, setTitle] = useState('');

  const activeSession = useMemo(
    () => sessions.find((session) => session.sessionId === selectedSessionId),
    [selectedSessionId, sessions],
  );

  const workspaceLabel = useMemo(() => getWorkspaceLabel(cwd, window.nami?.homeDir), [cwd]);

  const handleCreateSession = async () => {
    if (!cwd) {
      setBootError('Choose a workspace directory before creating a session.');
      return;
    }

    try {
      const session = await chatService.createSession({ cwd, title });
      upsertSession(session as never);
      selectSession(session.sessionId);
      setTitle('');
      setBootError(null);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Failed to create session.');
    }
  };

  const handleChooseDirectory = async () => {
    try {
      const result = await chatService.selectDirectory({ defaultPath: cwd || activeSession?.cwd });
      if (result.path) {
        setCwd(result.path);
      }
      setBootError(null);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Failed to choose directory.');
    }
  };

  return {
    sessions,
    selectedSessionId,
    title,
    cwd,
    workspaceLabel,
    bootError,
    setTitle,
    selectSession,
    handleCreateSession,
    handleChooseDirectory,
  };
};
