import type { UiTaskCreationOptions } from '../model/task';

const createDefaultOptions = (): UiTaskCreationOptions => ({
  taskBranchName: '',
  shouldMergeAfterReview: true,
});

const toCreateTaskOptions = (
  options: UiTaskCreationOptions,
): {
  taskBranchName?: string;
  shouldMergeAfterReview: boolean;
} => {
  const taskBranchName = options.taskBranchName.trim();

  return {
    taskBranchName: taskBranchName || undefined,
    shouldMergeAfterReview: options.shouldMergeAfterReview,
  };
};

export const taskCreationOptionsService = {
  createDefaultOptions,
  toCreateTaskOptions,
};
