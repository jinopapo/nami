/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_action'. Dependency is of type 'src_repository' */
/* eslint-disable max-lines */
import { useEffect, useMemo, useState } from 'react';
import { taskRepository } from '../repository/taskRepository';
import { useChatStore } from '../store/chatStore';
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
import { getWorkspaceLabel } from '../service/workspaceService';
import { taskBoardService } from '../service/taskBoardService';
import { taskCreationOptionsService } from '../service/taskCreationOptionsService';
import { taskLifecycleService } from '../service/taskLifecycleService';
import { useAutoCheckFormState } from '../service/useAutoCheckFormState';
import { useChatPanelReviewState } from '../service/useChatPanelReviewState';
import { useCurrentBranchState } from '../service/useCurrentBranchState';
import { usePlanningTransitionState } from '../service/usePlanningTransitionState';
import { useTaskPanelUiState } from '../service/useTaskPanelUiState';
import { useTaskDependencyState } from '../service/useTaskDependencyState';
import { windowService } from '../service/windowService';

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
  const [isPlanRevisionMode, setIsPlanRevisionMode] = useState(false);
  const [pendingTaskCreationId, setPendingTaskCreationId] = useState<
    string | null
  >(null);
  const {
    isDrawerOpen,
    isSettingsModalOpen,
    isTaskCreationOptionsExpanded,
    taskCreationOptions,
    setTaskCreationOptions,
    setIsTaskCreationOptionsExpanded,
    openDrawer,
    handleCreateTask,
    handleOpenTask,
    handleCloseDrawer,
    handleOpenSettingsModal,
    handleCloseSettingsModal,
  } = useTaskPanelUiState({
    cwd,
    createDefaultTaskCreationOptions:
      taskCreationOptionsService.createDefaultOptions,
    clearSelectedTask,
    setDraft,
    selectTask,
  });
  const activeTask = chatPanelViewStateService.getActiveTask(
    tasks,
    selectedTaskId,
  );
  const activeSession = chatPanelViewStateService.getActiveSession(
    sessionsByTask,
    selectedTaskId,
  );
  const displayItems = chatService.toDisplayItems(activeSession?.events ?? []);
  const timelineAutoScrollState = chatService.getTimelineAutoScrollState(
    activeTask,
    displayItems,
  );
  const pendingUserAction = chatService.getPendingUserAction(
    activeTask,
    activeSession?.events ?? [],
  );
  const isTaskWorkspaceInitializing =
    chatPanelViewStateService.isTaskWorkspaceInitializing(
      pendingTaskCreationId,
      selectedTaskId,
    );
  const displayStatus = useMemo(() => {
    if (isTaskWorkspaceInitializing)
      return {
        phase: 'initializing_workspace' as const,
        label: 'ワークスペース初期化中',
        tone: 'running' as const,
      };

    return chatService.getSessionStatus(
      activeTask,
      pendingUserAction,
      activeSession?.events ?? [],
    );
  }, [
    activeSession?.events,
    activeTask,
    isTaskWorkspaceInitializing,
    pendingUserAction,
  ]);
  const workspaceLabel = getWorkspaceLabel(cwd, window.nami?.homeDir);
  const boardColumns = taskBoardService.getTaskCardsByColumn(
    tasks,
    sessionsByTask,
  );
  const activeTitle = chatPanelViewStateService.getActiveTitle(
    activeTask,
    activeSession,
  );
  const taskLifecycleActions =
    taskLifecycleService.getTaskLifecycleActions(activeTask);
  const { retryAction, drawerActions, composerDecisionActions } = useMemo(
    () =>
      taskLifecycleService.getLifecycleActionPresentation(
        displayStatus.phase,
        taskLifecycleActions,
      ),
    [displayStatus.phase, taskLifecycleActions],
  );
  const {
    isPlanningTransitionInitializing,
    handlePlanningTransitionError,
    handlePlanningTransitionStart,
  } = usePlanningTransitionState(activeTask);
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
  const {
    createDependencyOptions,
    activeTaskDependencyOptions,
    taskDependencyDraftTaskIds,
    isTaskDependencyEditable,
    hasTaskDependencyChanges,
    isSavingTaskDependencies,
    handleToggleTaskCreationDependency,
    handleToggleTaskDependency,
    handleSaveTaskDependencies,
  } = useTaskDependencyState({
    activeTask,
    tasks,
    sessionsByTask,
    taskCreationOptions,
    setTaskCreationOptions,
    setBootError,
  });
  const isTaskDependencyPanelVisible =
    chatPanelViewStateService.isTaskDependencyPanelVisible(activeTask);
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
    openDrawer,
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
    onTransitionStart: handlePlanningTransitionStart,
    onTransitionError: handlePlanningTransitionError,
  });
  useEffect(() => {
    if (activeTask?.lifecycleState !== 'awaiting_confirmation')
      setIsPlanRevisionMode(false);
  }, [activeTask?.lifecycleState, activeTask?.taskId]);
  return {
    activeTask,
    displayItems,
    timelineAutoScrollState,
    displayStatus,
    boardColumns,
    activeTitle,
    drawerActions,
    composerDecisionActions,
    retryAction,
    isDrawerOpen,
    isSettingsModalOpen,
    isTaskCreationOptionsExpanded,
    workspaceLabel,
    currentBranch,
    bootError,
    draft,
    taskCreationOptions,
    createDependencyOptions,
    activeTaskDependencyOptions,
    taskDependencyDraftTaskIds,
    isTaskDependencyPanelVisible,
    isTaskDependencyEditable,
    hasTaskDependencyChanges,
    isSavingTaskDependencies,
    autoCheckForm,
    reviewTab,
    reviewDiffFiles,
    isReviewDiffLoading,
    reviewError,
    reviewCommitMessage,
    isReviewCommitRunning,
    isPlanRevisionMode,
    isPlanningTransitionInitializing,
    isTaskWorkspaceInitializing,
    setDraft,
    setTaskCreationOptions,
    setIsTaskCreationOptionsExpanded,
    setReviewCommitMessage,
    handleToggleTaskCreationDependency,
    handleToggleTaskDependency,
    handleSaveTaskDependencies,
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
