import type { UiChatSession, UiTask } from '../model/chat';

const getActiveTask = (
  tasks: UiTask[],
  selectedTaskId?: string,
): UiTask | undefined => tasks.find((task) => task.taskId === selectedTaskId);

const getActiveSession = (
  sessionsByTask: Record<string, UiChatSession>,
  selectedTaskId?: string,
): UiChatSession | undefined =>
  selectedTaskId ? sessionsByTask[selectedTaskId] : undefined;

const getActiveTitle = (
  activeTask: UiTask | undefined,
  activeSession: UiChatSession | undefined,
): string => {
  const firstUserMessage = activeSession?.events.find(
    (event) => event.type === 'userMessage',
  );

  return firstUserMessage?.type === 'userMessage'
    ? firstUserMessage.text.slice(0, 56)
    : activeTask
      ? `Task ${activeTask.taskId.slice(0, 8)}`
      : '新しいタスク';
};

const isTaskWorkspaceInitializing = (
  pendingTaskCreationId: string | null,
  selectedTaskId?: string,
): boolean =>
  pendingTaskCreationId !== null && selectedTaskId === pendingTaskCreationId;

export const chatPanelViewStateService = {
  getActiveTask,
  getActiveSession,
  getActiveTitle,
  isTaskWorkspaceInitializing,
};
