import { useMemo } from 'react';
import { useChatStore } from '../store/chatStore';
import { getWorkspaceLabel } from '../service/workspaceService';
import { chatService } from '../service/chatService';

export const useChatPanelAction = () => {
  const {
    tasks,
    selectedTaskId,
    sessionsByTask,
    draft,
    cwd,
    bootError,
    setDraft,
    setCwd,
    selectTask,
    setBootError,
    beginOptimisticSession,
    appendOptimisticUserEvent,
    appendLocalEvent,
    promoteOptimisticSession,
  } = useChatStore();

  const activeTask = useMemo(
    () => tasks.find((task) => task.taskId === selectedTaskId),
    [selectedTaskId, tasks],
  );

  const activeSession = useMemo(
    () => (selectedTaskId ? sessionsByTask[selectedTaskId] : undefined),
    [selectedTaskId, sessionsByTask],
  );

  const displayItems = useMemo(
    () => chatService.toDisplayItems(activeSession?.events ?? []),
    [activeSession?.events],
  );

  const waitingState = useMemo(() => chatService.getWaitingState(activeTask), [activeTask]);
  const pendingUserAction = useMemo(() => chatService.getPendingUserAction(activeTask, activeSession?.events ?? []), [activeTask, activeSession?.events]);
  const displayStatus = useMemo(() => chatService.getSessionStatus(activeTask, pendingUserAction, activeSession?.events ?? []), [activeTask, pendingUserAction, activeSession?.events]);

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

    const prompt = draft.trim();

    try {
      if (!selectedTaskId) {
        const { temporaryTaskId } = beginOptimisticSession({ prompt });
        const result = await chatService.startTask({ cwd, prompt });
        promoteOptimisticSession(temporaryTaskId, { taskId: result.taskId, sessionId: result.sessionId });
        selectTask(result.taskId);
      } else {
        appendOptimisticUserEvent({ taskId: selectedTaskId, prompt });
        await chatService.sendMessage({ taskId: selectedTaskId, prompt });
        selectTask(selectedTaskId);
      }
      setDraft('');
      setBootError(null);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Failed to send message.');
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
      appendLocalEvent(selectedTaskId, {
        type: 'permissionResponse',
        role: 'user',
        delivery: 'optimistic',
        taskId: selectedTaskId,
        sessionId: activeSession?.sessionId,
        timestamp: new Date().toISOString(),
        approvalId,
        decision,
      });
      appendLocalEvent(selectedTaskId, {
        type: 'taskStateChanged',
        role: 'assistant',
        delivery: 'optimistic',
        taskId: selectedTaskId,
        sessionId: activeSession?.sessionId,
        timestamp: new Date().toISOString(),
        state: 'running',
        reason: 'permission_resolved',
      });
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
      appendLocalEvent(selectedTaskId, {
        type: 'abort',
        role: 'user',
        delivery: 'optimistic',
        taskId: selectedTaskId,
        sessionId: activeSession?.sessionId,
        timestamp: new Date().toISOString(),
      });
      await chatService.abortTask({ taskId: selectedTaskId });
      setBootError(null);
    } catch (error) {
      setBootError(error instanceof Error ? error.message : 'Failed to stop task.');
    }
  };

  return {
    activeTask,
    activeSession,
    displayItems,
    waitingState,
    pendingUserAction,
    displayStatus,
    workspaceLabel,
    bootError,
    draft,
    setDraft,
    handleChooseDirectory,
    handleSend,
    handleApproval,
    handleAbort,
  };
};
