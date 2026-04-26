/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_action'. Dependency is of type 'src_repository' */
import { useEffect, useMemo, useState } from 'react';
import { taskRepository } from '../repository/taskRepository';
import { useChatStore } from '../store/chatStore';
import { getWorkspaceLabel } from '../service/workspaceService';
import { chatService } from '../service/chatService';
import {
  createAbortHandler,
  createApprovalHandler,
  createChooseDirectoryHandler,
  createOpenWindowHandler,
  createSendHandler,
  createTaskLifecycleActionHandler,
} from '../service/chatPanelActionFactory';
import { chatPanelTaskActionService } from '../service/chatPanelTaskActionService';
import { chatPanelViewStateService } from '../service/chatPanelViewStateService';
import { taskBoardService } from '../service/taskBoardService';
import { taskCreationOptionsService } from '../service/taskCreationOptionsService';
import { useAutoCheckFormState } from '../service/useAutoCheckFormState';
import { useChatPanelReviewState } from '../service/useChatPanelReviewState';
import { useCurrentBranchState } from '../service/useCurrentBranchState';
import { windowService } from '../service/windowService';
import { taskLifecycleService } from '../service/taskLifecycleService';

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
    discardOptimisticSession,
  } = useChatStore();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPlanRevisionMode, setIsPlanRevisionMode] = useState(false);
  const [pendingTaskCreationId, setPendingTaskCreationId] = useState<
    string | null
  >(null);
  const [taskCreationOptions, setTaskCreationOptions] = useState(
    taskCreationOptionsService.createDefaultOptions,
  );

  const activeTask = useMemo(
    () => chatPanelViewStateService.getActiveTask(tasks, selectedTaskId),
    [selectedTaskId, tasks],
  );

  const activeSession = useMemo(
    () =>
      chatPanelViewStateService.getActiveSession(
        sessionsByTask,
        selectedTaskId,
      ),
    [selectedTaskId, sessionsByTask],
  );

  const displayItems = useMemo(
    () => chatService.toDisplayItems(activeSession?.events ?? []),
    [activeSession?.events],
  );
  const timelineAutoScrollState = useMemo(
    () => chatService.getTimelineAutoScrollState(activeTask, displayItems),
    [activeTask, displayItems],
  );

  const waitingState = useMemo(
    () => chatService.getWaitingState(activeTask),
    [activeTask],
  );
  const pendingUserAction = useMemo(
    () =>
      chatService.getPendingUserAction(activeTask, activeSession?.events ?? []),
    [activeTask, activeSession?.events],
  );
  const isTaskWorkspaceInitializing = useMemo(
    () =>
      chatPanelViewStateService.isTaskWorkspaceInitializing(
        pendingTaskCreationId,
        selectedTaskId,
      ),
    [pendingTaskCreationId, selectedTaskId],
  );
  const displayStatus = useMemo(() => {
    if (isTaskWorkspaceInitializing) {
      return {
        phase: 'initializing_workspace' as const,
        label: 'ワークスペース初期化中',
        tone: 'running' as const,
      };
    }

    return chatService.getSessionStatus(
      activeTask,
      pendingUserAction,
      activeSession?.events ?? [],
    );
  }, [
    activeTask,
    activeSession?.events,
    isTaskWorkspaceInitializing,
    pendingUserAction,
  ]);

  const workspaceLabel = useMemo(
    () => getWorkspaceLabel(cwd, window.nami?.homeDir),
    [cwd],
  );
  const boardColumns = useMemo(
    () => taskBoardService.getTaskCardsByColumn(tasks, sessionsByTask),
    [tasks, sessionsByTask],
  );

  const activeTitle = useMemo(
    () => chatPanelViewStateService.getActiveTitle(activeTask, activeSession),
    [activeSession?.events, activeTask],
  );

  const taskLifecycleActions = useMemo(
    () => taskLifecycleService.getTaskLifecycleActions(activeTask),
    [activeTask],
  );
  const { currentBranch } = useCurrentBranchState(cwd);
  const {
    autoCheckForm,
    handleAutoCheckEnabledChange,
    handleAutoCheckStepChange,
    handleAutoCheckAddStep,
    handleAutoCheckRemoveStep,
    handleSaveAutoCheck,
    handleRunAutoCheck,
  } = useAutoCheckFormState(
    cwd,
    activeTask?.latestAutoCheckResult,
    setBootError,
  );
  const {
    reviewTab,
    reviewDiffFiles,
    isReviewDiffLoading,
    reviewError,
    reviewCommitMessage,
    isReviewCommitRunning,
    setReviewCommitMessage,
    handleReviewTabChange,
    handleReviewCommit,
  } = useChatPanelReviewState(activeTask, setBootError);

  const handleChooseDirectory = createChooseDirectoryHandler({
    cwd,
    activeTaskCwd: activeTask?.cwd,
    selectDirectory: taskRepository.selectDirectory,
    setCwd,
    setBootError,
  });
  const handleOpenWindow = createOpenWindowHandler({
    openWindow: windowService.openWindow,
    setBootError,
  });
  const handleSend = createSendHandler({
    cwd,
    prompt: chatPanelTaskActionService.getPrompt(draft),
    sendMode: chatPanelTaskActionService.resolveSendMode(
      selectedTaskId,
      activeTask,
      isPlanRevisionMode,
    ),
    currentTaskId: selectedTaskId,
    beginOptimisticSession,
    setPendingTaskCreationId,
    openDrawer: () => setIsDrawerOpen(true),
    createTask: taskRepository.create,
    ...taskCreationOptionsService.toCreateTaskOptions(taskCreationOptions),
    promoteOptimisticSession,
    selectTask,
    appendOptimisticUserEvent,
    transitionLifecycle: taskRepository.transitionLifecycle,
    sendMessage: chatService.sendMessage,
    clearDraft: () => setDraft(''),
    exitPlanRevisionMode: () => setIsPlanRevisionMode(false),
    setBootError,
    discardOptimisticSession,
  });
  const handleApproval = createApprovalHandler({
    selectedTaskId,
    createApprovalResolvedEvents: (approvalId, decision) =>
      chatPanelTaskActionService.createApprovalResolvedEvents({
        taskId: selectedTaskId ?? '',
        sessionId: activeSession?.sessionId,
        approvalId,
        decision,
      }),
    appendLocalEvent,
    resumeTask: chatService.resumeTask,
    setBootError,
  });
  const handleAbort = createAbortHandler({
    selectedTaskId,
    createAbortEvent: () =>
      chatPanelTaskActionService.createAbortEvent({
        taskId: selectedTaskId ?? '',
        sessionId: activeSession?.sessionId,
      }),
    appendLocalEvent,
    abortTask: chatService.abortTask,
    setBootError,
  });
  const handleTaskLifecycleAction = createTaskLifecycleActionHandler({
    activeTask,
    shouldEnterPlanRevisionMode: (nextState) =>
      Boolean(
        activeTask &&
        chatPanelTaskActionService.shouldEnterPlanRevisionMode(
          activeTask.lifecycleState,
          nextState,
        ),
      ),
    enterPlanRevisionMode: () => setIsPlanRevisionMode(true),
    exitPlanRevisionMode: () => setIsPlanRevisionMode(false),
    transitionLifecycle: taskRepository.transitionLifecycle,
    createRetryEvent: () =>
      chatPanelTaskActionService.createRetryEvent({
        taskId: activeTask?.taskId ?? '',
        sessionId: activeSession?.sessionId,
      }),
    appendLocalEvent,
    resumeTask: chatService.resumeTask,
    setBootError,
  });

  useEffect(() => {
    if (activeTask?.lifecycleState !== 'awaiting_confirmation') {
      setIsPlanRevisionMode(false);
    }
  }, [activeTask?.lifecycleState, activeTask?.taskId]);

  const handleCreateTask = () => {
    clearSelectedTask();
    setDraft('');
    setTaskCreationOptions(taskCreationOptionsService.createDefaultOptions());
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
  const handleOpenSettingsModal = () => cwd && setIsSettingsModalOpen(true);
  const handleCloseSettingsModal = () => setIsSettingsModalOpen(false);

  return {
    activeTask,
    activeSession,
    displayItems,
    timelineAutoScrollState,
    waitingState,
    pendingUserAction,
    displayStatus,
    boardColumns,
    activeTitle,
    taskLifecycleActions,
    isDrawerOpen,
    isSettingsModalOpen,
    workspaceLabel,
    currentBranch,
    bootError,
    draft,
    taskCreationOptions,
    autoCheckForm,
    reviewTab,
    reviewDiffFiles,
    isReviewDiffLoading,
    reviewError,
    reviewCommitMessage,
    isReviewCommitRunning,
    isPlanRevisionMode,
    isTaskWorkspaceInitializing,
    setDraft,
    setTaskCreationOptions,
    setReviewCommitMessage,
    handleChooseDirectory,
    handleOpenWindow,
    handleCreateTask,
    handleOpenTask,
    handleCloseDrawer,
    handleOpenSettingsModal,
    handleCloseSettingsModal,
    handleSend,
    handleApproval,
    handleAbort,
    handleTaskLifecycleAction,
    handleReviewTabChange,
    handleReviewCommit,
    handleAutoCheckEnabledChange,
    handleAutoCheckStepChange,
    handleAutoCheckAddStep,
    handleAutoCheckRemoveStep,
    handleSaveAutoCheck,
    handleRunAutoCheck,
  };
};
