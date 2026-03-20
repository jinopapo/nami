import { useMemo } from 'react';
import { useChatStore } from '../store/chatStore';
import { chatService } from '../service/chatService';
import { getWorkspaceLabel } from '../service/workspaceService';

export const useChatPanelAction = () => {
  const {
    tasks,
    selectedTaskId,
    eventsByTask,
    draft,
    sending,
    cwd,
    bootError,
    setDraft,
    setSending,
    setCwd,
    selectTask,
    setBootError,
  } = useChatStore();

  const activeTask = useMemo(
    () => tasks.find((task) => task.taskId === selectedTaskId),
    [selectedTaskId, tasks],
  );

  const activeEvents = useMemo(
    () => (selectedTaskId ? eventsByTask[selectedTaskId] ?? [] : []),
    [eventsByTask, selectedTaskId],
  );

  const isTaskRunning = useMemo(() => {
    if (sending) {
      return true;
    }
    return activeTask?.state === 'running';
  }, [activeTask?.state, sending]);

  const waitingState = useMemo(() => chatService.getWaitingState(activeTask), [activeTask]);

  const workspaceLabel = useMemo(() => getWorkspaceLabel(cwd, window.nami?.homeDir), [cwd]);

  const handleChooseDirectory = async () => {
    try {
      const result = await chatService.selectDirectory({ defaultPath: cwd || activeTask?.cwd });
      if (!result.path) {
        return;
      }

      setCwd(result.path);

      setBootError(null);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Failed to choose directory.');
    }
  };

  const handleSend = async () => {
    if (!cwd || !draft.trim()) {
      return;
    }

    setSending(true);

    try {
      const result = await chatService.startTask({ cwd, prompt: draft });
      selectTask(result.taskId);
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
    if (!selectedTaskId) {
      return;
    }

    try {
      await chatService.resumeTask({ taskId: selectedTaskId, reason: 'permission', payload: { approvalId, decision } });
      setBootError(null);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Failed to respond to approval.');
    }
  };

  const handleAbort = async () => {
    if (!selectedTaskId) {
      return;
    }

    try {
      await chatService.abortTask({ taskId: selectedTaskId });
      setBootError(null);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Failed to stop task.');
    }
  };

  const latestHumanDecisionRequest = useMemo(() => [...activeEvents].reverse().find((event) => event.type === 'humanDecisionRequest'), [activeEvents]);

  const latestPermissionRequest = useMemo(() => [...activeEvents].reverse().find((event) => event.type === 'permissionRequest'), [activeEvents]);

  const latestReadableMessage = useMemo(() => [...activeEvents].reverse().find(chatService.hasReadableMessage), [activeEvents]);

  return {
    selectedTaskId,
    activeTask,
    activeEvents,
    isTaskRunning,
    waitingState,
    latestHumanDecisionRequest,
    latestPermissionRequest,
    latestReadableMessage,
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
