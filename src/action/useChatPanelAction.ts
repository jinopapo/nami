import { useMemo } from 'react';
import { useChatStore } from '../store/chatStore';
import { getWorkspaceLabel } from '../service/workspaceService';
import { chatService } from '../service/chatService';

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

  const isTaskRunning = useMemo(() => {
    return activeSession?.phase === 'submitting' || activeSession?.phase === 'running';
  }, [activeSession?.phase]);

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
    const temporaryTaskId = beginOptimisticSession({ prompt });
    setSending(true);

    try {
      const result = await chatService.startTask({ cwd, prompt });
      promoteOptimisticSession(temporaryTaskId, result);
      selectTask(result.taskId);
      setDraft('');
      setBootError(null);
    } catch (error) {
      selectTask(temporaryTaskId);
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

  const latestHumanDecisionRequest = useMemo(() => [...(activeSession?.activities ?? [])].reverse().find((event) => event.type === 'humanDecisionRequest'), [activeSession?.activities]);

  const latestPermissionRequest = useMemo(() => [...(activeSession?.activities ?? [])].reverse().find((event) => event.type === 'permissionRequest'), [activeSession?.activities]);

  const latestReadableMessage = useMemo(() => [...(activeSession?.messages ?? [])].reverse().find((message) => message.text.length > 0), [activeSession?.messages]);

  const latestToolCall = useMemo(() => [...(activeSession?.activities ?? [])].reverse().find((event) => event.type === 'toolCall'), [activeSession?.activities]);

  const phaseLabel = useMemo(() => {
    switch (activeSession?.phase) {
      case 'submitting':
        return '依頼受付中';
      case 'running':
        return '作業中';
      case 'waiting_permission':
        return '承認待ち';
      case 'waiting_human_decision':
        return '入力待ち';
      case 'completed':
        return '応答完了';
      case 'error':
        return 'エラー';
      case 'aborted':
        return '停止済み';
      default:
        return '待機中';
    }
  }, [activeSession?.phase]);

  const phaseDescription = useMemo(() => {
    if (activeSession?.phase === 'submitting') {
      return '送信した内容を反映し、Cline セッションを起動しています。';
    }
    if (activeSession?.phase === 'waiting_permission') {
      return latestPermissionRequest?.title ?? '続行には承認が必要です。';
    }
    if (activeSession?.phase === 'waiting_human_decision') {
      return latestHumanDecisionRequest?.title ?? '続行に必要な入力を待っています。';
    }
    if (latestToolCall?.title) {
      return `${latestToolCall.title} を実行しています。`;
    }
    return latestReadableMessage?.text ?? '依頼内容を入力して送信すると、ここに会話が表示されます。';
  }, [activeSession?.phase, latestHumanDecisionRequest?.title, latestPermissionRequest?.title, latestReadableMessage?.text, latestToolCall?.title]);

  const actionMessage = useMemo(() => {
    if (activeSession?.phase === 'waiting_permission') {
      return '下の承認カードから Approve / Reject を選ぶと続行します。';
    }
    if (activeSession?.phase === 'waiting_human_decision') {
      return latestHumanDecisionRequest?.description ?? '追加の人間判断が必要です。';
    }
    if (isTaskRunning) {
      return '処理中でも次の依頼を下書きできます。';
    }
    return undefined;
  }, [activeSession?.phase, isTaskRunning, latestHumanDecisionRequest?.description]);

  const displayStatus = useMemo(
    () => getDisplayStatus(activeSession?.phase),
    [activeSession?.phase],
  );

  return {
    selectedTaskId,
    activeTask,
    activeSession,
    isTaskRunning,
    waitingState,
    latestHumanDecisionRequest,
    latestPermissionRequest,
    latestReadableMessage,
    phaseLabel,
    phaseDescription,
    actionMessage,
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
