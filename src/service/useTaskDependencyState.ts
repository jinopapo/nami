import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { UiChatSession } from '../model/chat';
import type { UiTask, UiTaskCreationOptions } from '../model/task';
import { taskRepository } from '../repository/taskRepository';

type DependencyOption = {
  taskId: string;
  label: string;
  description: string;
};

type UseTaskDependencyStateInput = {
  activeTask?: UiTask;
  tasks: UiTask[];
  sessionsByTask: Record<string, UiChatSession>;
  taskCreationOptions: UiTaskCreationOptions;
  setTaskCreationOptions: Dispatch<SetStateAction<UiTaskCreationOptions>>;
  setBootError: (value: string | null) => void;
};

const toggleTaskId = (taskIds: string[], taskId: string): string[] =>
  taskIds.includes(taskId)
    ? taskIds.filter((currentTaskId) => currentTaskId !== taskId)
    : [...taskIds, taskId];

const areSameTaskIdSet = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((taskId) => rightSet.has(taskId));
};

const getTaskLabel = (
  task: UiTask,
  sessionsByTask: Record<string, UiChatSession>,
): string => {
  const firstUserMessage = sessionsByTask[task.taskId]?.events.find(
    (event) => event.type === 'userMessage',
  );

  return firstUserMessage?.type === 'userMessage'
    ? firstUserMessage.text.slice(0, 56)
    : `Task ${task.taskId.slice(0, 8)}`;
};

export const useTaskDependencyState = (input: UseTaskDependencyStateInput) => {
  const [taskDependencyDraftTaskIds, setTaskDependencyDraftTaskIds] = useState<
    string[]
  >([]);
  const [isSavingTaskDependencies, setIsSavingTaskDependencies] =
    useState(false);

  const dependencyOptions = useMemo<DependencyOption[]>(
    () =>
      input.tasks
        .filter((task) => task.reviewMergePolicy === 'merge_to_base')
        .map((task) => ({
          taskId: task.taskId,
          label: getTaskLabel(task, input.sessionsByTask),
          description: `${task.lifecycleState} / ${task.taskId}`,
        })),
    [input.sessionsByTask, input.tasks],
  );

  const createDependencyOptions = dependencyOptions;
  const activeTaskDependencyOptions = useMemo(
    () =>
      dependencyOptions.filter(
        (option) => option.taskId !== input.activeTask?.taskId,
      ),
    [input.activeTask?.taskId, dependencyOptions],
  );

  const handleToggleTaskCreationDependency = (taskId: string) => {
    input.setTaskCreationOptions((current) => ({
      ...current,
      dependencyTaskIds: toggleTaskId(current.dependencyTaskIds, taskId),
    }));
  };

  const handleToggleTaskDependency = (taskId: string) => {
    setTaskDependencyDraftTaskIds((current) => toggleTaskId(current, taskId));
  };

  const handleSaveTaskDependencies = async () => {
    if (!input.activeTask) {
      return;
    }

    try {
      setIsSavingTaskDependencies(true);
      await taskRepository.updateDependencies({
        taskId: input.activeTask.taskId,
        dependencyTaskIds: taskDependencyDraftTaskIds,
      });
      input.setBootError(null);
    } catch (error) {
      input.setBootError(
        error instanceof Error
          ? error.message
          : 'Failed to update task dependencies.',
      );
    } finally {
      setIsSavingTaskDependencies(false);
    }
  };

  useEffect(() => {
    setTaskDependencyDraftTaskIds(input.activeTask?.dependencyTaskIds ?? []);
  }, [input.activeTask?.dependencyTaskIds, input.activeTask?.taskId]);

  const isTaskDependencyEditable =
    input.activeTask?.reviewMergePolicy === 'merge_to_base' &&
    ['waiting_dependencies', 'before_start'].includes(
      input.activeTask.lifecycleState,
    );
  const hasTaskDependencyChanges = input.activeTask
    ? !areSameTaskIdSet(
        input.activeTask.dependencyTaskIds,
        taskDependencyDraftTaskIds,
      )
    : false;

  return {
    createDependencyOptions,
    activeTaskDependencyOptions,
    taskDependencyDraftTaskIds,
    isTaskDependencyEditable,
    hasTaskDependencyChanges,
    isSavingTaskDependencies,
    handleToggleTaskCreationDependency,
    handleToggleTaskDependency,
    handleSaveTaskDependencies,
  };
};
