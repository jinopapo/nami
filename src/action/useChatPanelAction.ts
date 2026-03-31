import { useMemo, useState } from 'react';
import { taskRepository } from '../repository/taskRepository';
import { useChatStore } from '../store/chatStore';
import { getWorkspaceLabel } from '../service/workspaceService';
import { chatService } from '../service/chatService';
import { taskBoardService } from '../service/taskBoardService';

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
    clearSelectedTask,
    setBootError,
    beginOptimisticSession,
    appendOptimisticUserEvent,
    appendLocalEvent,
    promoteOptimisticSession,
  } = useChatStore();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
  const boardColumns = useMemo(() => taskBoardService.getTaskCardsByColumn(tasks, sessionsByTask), [tasks, sessionsByTask]);

  const activeTitle = useMemo(() => {
    const firstUserMessage = activeSession?.events.find((event) => event.type === 'userMessage');
    return firstUserMessage?.type === 'userMessage'
      ? firstUserMessage.text.slice(0, 56)
      : activeTask
        ? `Task ${activeTask.taskId.slice(0, 8)}`
        : '新しいタスク';
  }, [activeSession?.events, activeTask]);

  const actionLabels = useMemo(() => {
    if (!activeTask) {
      return ['計画を開始'];
    }

    switch (activeTask.lifecycleState) {
      case 'planning':
        return ['確認待ちへ'];
      case 'awaiting_confirmation':
        return ['計画に戻す', '実行へ進める'];
      case 'executing':
        return ['作業を停止'];
      case 'awaiting_review':
        return ['実行に戻す', '完了にする'];
      case 'completed':
        return ['再オープン'];
      default:
        return [];
    }
  }, [activeTask]);

  const handleChooseDirectory = async () => {
    try {
      const result = await taskRepository.selectDirectory({ defaultPath: cwd || activeTask?.cwd });
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
        const result = await taskRepository.create({ cwd, prompt });
        promoteOptimisticSession(temporaryTaskId, { taskId: result.taskId, sessionId: result.sessionId });
        selectTask(result.taskId);
        setIsDrawerOpen(true);
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

  const handleCreateTask = () => {
    clearSelectedTask();
    setDraft('');
    setIsDrawerOpen(true);
  };

  const handleOpenTask = (taskId: string) => {
    selectTask(taskId);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    clearSelectedTask();
  };

  return {
    activeTask,
    activeSession,
    displayItems,
    waitingState,
    pendingUserAction,
    displayStatus,
    boardColumns,
    activeTitle,
    actionLabels,
    isDrawerOpen,
    workspaceLabel,
    bootError,
    draft,
    setDraft,
    handleChooseDirectory,
    handleCreateTask,
    handleOpenTask,
    handleCloseDrawer,
    handleSend,
    handleApproval,
    handleAbort,
  };
};
