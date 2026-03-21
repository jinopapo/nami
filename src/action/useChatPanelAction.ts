import { useMemo } from 'react';
import { useChatStore } from '../store/chatStore';
import { getWorkspaceLabel } from '../service/workspaceService';
import { chatService } from '../service/chatService';
import type { UiTurn } from '../model/chat';

const getDisplayStatus = (
  phase?: string,
): { label: string; tone: 'running' | 'waiting' | 'completed' | 'idle' } => {
  if (phase === 'submitting' || phase === 'running') {
    return { label: '実行中', tone: 'running' };
  }

  if (phase === 'waiting_permission' || phase === 'waiting_human_decision') {
    return { label: '人間の承認待ち', tone: 'waiting' };
  }

  if (phase === 'completed') {
    return { label: '完了', tone: 'completed' };
  }

  return { label: '待機中', tone: 'idle' };
};

const getLatestTurn = (turns?: UiTurn[]) => turns?.at(-1);

export const useChatPanelAction = () => {
  const {
    tasks,
    selectedTaskId,
    sessionsByTask,
    draft,
    sending,
    cwd,
    bootError,
    setDraft,
    setSending,
    setCwd,
    selectTask,
    setBootError,
    beginOptimisticSession,
    appendOptimisticTurn,
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

  const activeTurn = useMemo(() => getLatestTurn(activeSession?.turns), [activeSession?.turns]);

  const isTaskRunning = useMemo(() => {
    return activeTurn?.state === 'submitting' || activeTurn?.state === 'running';
  }, [activeTurn?.state]);

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

    const prompt = draft.trim();
    setSending(true);

    try {
      if (!selectedTaskId) {
        const { temporaryTaskId } = beginOptimisticSession({ prompt });
        const result = await chatService.startTask({ cwd, prompt });
        promoteOptimisticSession(temporaryTaskId, result);
        selectTask(result.taskId);
      } else {
        appendOptimisticTurn({ taskId: selectedTaskId, prompt });
        await chatService.sendMessage({ taskId: selectedTaskId, prompt });
        selectTask(selectedTaskId);
      }
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

  const latestPermissionRequest = useMemo(() => [...(activeSession?.activities ?? [])].reverse().find((event) => event.type === 'permissionRequest'), [activeSession?.activities]);

  const displayStatus = useMemo(
    () => getDisplayStatus(activeTurn?.state),
    [activeTurn?.state],
  );

  return {
    activeTask,
    activeSession,
    isTaskRunning,
    waitingState,
    latestPermissionRequest,
    displayStatus,
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
