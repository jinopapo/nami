import type { UiChatSession } from '../model/chat';
import type { UiTask } from '../model/task';

type PendingTaskLifecycleTransition = {
  taskId: string;
  nextState: UiTask['lifecycleState'];
};

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

const isPlanningTransitionInitializing = (
  pendingTransition: PendingTaskLifecycleTransition | null,
  activeTask?: UiTask,
): boolean =>
  pendingTransition?.nextState === 'planning' &&
  activeTask?.taskId === pendingTransition.taskId &&
  activeTask.lifecycleState === 'before_start';

const isTaskDependencyPanelVisible = (activeTask?: UiTask): boolean =>
  activeTask !== undefined &&
  ['waiting_dependencies', 'before_start'].includes(activeTask.lifecycleState);

// eslint-disable-next-line no-grouped-exports/no-exported-function-object -- Existing service object; clean up separately.
export const chatPanelViewStateService = {
  getActiveTask,
  getActiveSession,
  getActiveTitle,
  isTaskWorkspaceInitializing,
  isPlanningTransitionInitializing,
  isTaskDependencyPanelVisible,
};
