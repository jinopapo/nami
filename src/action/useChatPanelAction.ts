import { useEffect, useMemo, useState } from 'react';
import type { SessionEvent } from '../model/chat';
import { chatService } from '../service/chatService';
import { createChatPanelCommandActions } from '../service/chatPanelCommandActionService';
import { chatPanelTaskActionService } from '../service/chatPanelTaskActionService';
import { chatPanelViewStateService } from '../service/chatPanelViewStateService';
import { taskBoardService } from '../service/taskBoardService';
import { taskCreationOptionsService } from '../service/taskCreationOptionsService';
import { taskLifecycleService } from '../service/taskLifecycleService';
import { useAutoApprovalFormState } from '../service/useAutoApprovalFormState';
import { useAutoCheckFormState } from '../service/useAutoCheckFormState';
import { useChatPanelReviewState } from '../service/useChatPanelReviewState';
import { useCurrentBranchState } from '../service/useCurrentBranchState';
import { usePlanningTransitionState } from '../service/usePlanningTransitionState';
import { useTaskDependencyState } from '../service/useTaskDependencyState';
import { useTaskPanelUiState } from '../service/useTaskPanelUiState';
import { getWorkspaceLabel } from '../service/workspaceService';
import { useChatStore } from '../store/chatStore';

export const useChatPanelAction = () => {
  const store = useChatStore();
  const [isPlanRevisionMode, setIsPlanRevisionMode] = useState(false);
  const [pendingTaskCreationId, setPendingTaskCreationId] = useState<
    string | null
  >(null);
  const uiState = useTaskPanelUiState({
    cwd: store.cwd,
    createDefaultTaskCreationOptions:
      taskCreationOptionsService.createDefaultOptions,
    clearSelectedTask: store.clearSelectedTask,
    setDraft: store.setDraft,
    selectTask: store.selectTask,
  });
  const activeTask = chatPanelViewStateService.getActiveTask(
    store.tasks,
    store.selectedTaskId,
  );
  const activeSession = chatPanelViewStateService.getActiveSession(
    store.sessionsByTask,
    store.selectedTaskId,
  );
  const displayItems = chatService.toDisplayItems(activeSession?.events ?? []);
  const timelineAutoScrollState = chatService.getTimelineAutoScrollState(
    activeTask,
    displayItems,
  );
  const isTaskWorkspaceInitializing =
    chatPanelViewStateService.isTaskWorkspaceInitializing(
      pendingTaskCreationId,
      store.selectedTaskId,
    );
  const displayStatus = useMemo(() => {
    if (isTaskWorkspaceInitializing) {
      return {
        phase: 'initializing_workspace' as const,
        label: 'ワークスペース初期化中',
        tone: 'running' as const,
      };
    }

    const pendingUserAction = chatService.getPendingUserAction(
      activeTask,
      activeSession?.events ?? [],
    );

    return chatService.getSessionStatus(
      activeTask,
      pendingUserAction,
      activeSession?.events ?? [],
    );
  }, [activeSession?.events, activeTask, isTaskWorkspaceInitializing]);
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
  const planningTransitionState = usePlanningTransitionState(activeTask);
  const { currentBranch } = useCurrentBranchState(store.cwd);
  const autoApprovalState = useAutoApprovalFormState(
    store.cwd,
    store.setBootError,
  );
  const autoCheckState = useAutoCheckFormState(
    store.cwd,
    activeTask?.latestAutoCheckResult,
    store.setBootError,
  );
  const reviewState = useChatPanelReviewState(activeTask, store.setBootError);
  const taskDependencyState = useTaskDependencyState({
    activeTask,
    tasks: store.tasks,
    sessionsByTask: store.sessionsByTask,
    taskCreationOptions: uiState.taskCreationOptions,
    setTaskCreationOptions: uiState.setTaskCreationOptions,
    setBootError: store.setBootError,
  });
  const createTaskOptions = taskCreationOptionsService.toCreateTaskOptions(
    uiState.taskCreationOptions,
  );
  const commandActions = createChatPanelCommandActions<SessionEvent>({
    cwd: store.cwd,
    activeTaskCwd: activeTask?.cwd,
    setCwd: store.setCwd,
    prompt: chatPanelTaskActionService.getPrompt(store.draft),
    sendMode: chatPanelTaskActionService.resolveSendMode(
      store.selectedTaskId,
      activeTask,
      isPlanRevisionMode,
    ),
    selectedTaskId: store.selectedTaskId,
    activeTaskId: activeTask?.taskId,
    reviewMergePolicy: createTaskOptions.reviewMergePolicy,
    taskBranchName: createTaskOptions.taskBranchName,
    dependencyTaskIds: createTaskOptions.dependencyTaskIds,
    beginOptimisticSession: store.beginOptimisticSession,
    setPendingTaskCreationId,
    openDrawer: uiState.openDrawer,
    promoteOptimisticSession: store.promoteOptimisticSession,
    selectTask: store.selectTask,
    appendOptimisticUserEvent: store.appendOptimisticUserEvent,
    clearDraft: () => store.setDraft(''),
    exitPlanRevisionMode: () => setIsPlanRevisionMode(false),
    discardOptimisticSession: store.discardOptimisticSession,
    createApprovalResolvedEvents: (approvalId, decision) =>
      chatPanelTaskActionService.createApprovalResolvedEvents({
        taskId: store.selectedTaskId ?? '',
        sessionId: activeSession?.sessionId,
        approvalId,
        decision,
      }),
    appendLocalEvent: store.appendLocalEvent,
    createAbortEvent: () =>
      chatPanelTaskActionService.createAbortEvent({
        taskId: store.selectedTaskId ?? '',
        sessionId: activeSession?.sessionId,
      }),
    shouldEnterPlanRevisionMode: (nextState) =>
      Boolean(
        activeTask &&
        chatPanelTaskActionService.shouldEnterPlanRevisionMode(
          activeTask.lifecycleState,
          nextState,
        ),
      ),
    enterPlanRevisionMode: () => setIsPlanRevisionMode(true),
    createRetryEvent: () =>
      chatPanelTaskActionService.createRetryEvent({
        taskId: activeTask?.taskId ?? '',
        sessionId: activeSession?.sessionId,
      }),
    setBootError: store.setBootError,
    onTransitionStart: planningTransitionState.handlePlanningTransitionStart,
    onTransitionError: planningTransitionState.handlePlanningTransitionError,
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
    boardColumns: taskBoardService.getTaskCardsByColumn(
      store.tasks,
      store.sessionsByTask,
    ),
    activeTitle: chatPanelViewStateService.getActiveTitle(
      activeTask,
      activeSession,
    ),
    drawerActions,
    composerDecisionActions,
    retryAction,
    workspaceLabel: getWorkspaceLabel(store.cwd, window.nami?.homeDir),
    currentBranch,
    bootError: store.bootError,
    draft: store.draft,
    isPlanRevisionMode,
    isPlanningTransitionInitializing:
      planningTransitionState.isPlanningTransitionInitializing,
    isTaskWorkspaceInitializing,
    setDraft: store.setDraft,
    isTaskDependencyPanelVisible:
      chatPanelViewStateService.isTaskDependencyPanelVisible(activeTask),
    ...uiState,
    ...taskDependencyState,
    ...autoApprovalState,
    ...autoCheckState,
    ...reviewState,
    ...commandActions,
  };
};
