import { useMemo } from 'react';
import type { UiChatSession } from '../model/chat';
import type { UiTask } from '../model/task';
import { chatService } from '../service/chatService';
import { chatPanelViewStateService } from '../service/chatPanelViewStateService';
import { getWorkspaceLabel } from '../service/workspaceService';
import { taskBoardService } from '../service/taskBoardService';
import { taskLifecycleService } from '../service/taskLifecycleService';

type UseChatPanelDerivedStateInput = {
  tasks: UiTask[];
  selectedTaskId?: string;
  sessionsByTask: Record<string, UiChatSession>;
  pendingTaskCreationId: string | null;
  cwd: string;
  homeDir?: string;
};

export const useChatPanelDerivedState = (
  input: UseChatPanelDerivedStateInput,
) => {
  const activeTask = chatPanelViewStateService.getActiveTask(
    input.tasks,
    input.selectedTaskId,
  );
  const activeSession = chatPanelViewStateService.getActiveSession(
    input.sessionsByTask,
    input.selectedTaskId,
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
      input.pendingTaskCreationId,
      input.selectedTaskId,
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

  return {
    activeTask,
    activeSession,
    displayItems,
    timelineAutoScrollState,
    displayStatus,
    workspaceLabel: getWorkspaceLabel(input.cwd, input.homeDir),
    boardColumns: taskBoardService.getTaskCardsByColumn(
      input.tasks,
      input.sessionsByTask,
    ),
    activeTitle: chatPanelViewStateService.getActiveTitle(
      activeTask,
      activeSession,
    ),
    retryAction,
    drawerActions,
    composerDecisionActions,
    isTaskWorkspaceInitializing,
  };
};
