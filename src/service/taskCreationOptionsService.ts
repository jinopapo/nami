import type { UiTaskCreationOptions } from '../model/task';

const createDefaultOptions = (): UiTaskCreationOptions => ({
  taskBranchName: '',
  reviewMergePolicy: 'merge_to_base',
});

const toCreateTaskOptions = (
  options: UiTaskCreationOptions,
): {
  taskBranchName?: string;
  reviewMergePolicy: UiTaskCreationOptions['reviewMergePolicy'];
} => {
  const taskBranchName = options.taskBranchName.trim();

  return {
    taskBranchName: taskBranchName || undefined,
    reviewMergePolicy: taskBranchName ? 'preserve_branch' : 'merge_to_base',
  };
};

export const taskCreationOptionsService = {
  createDefaultOptions,
  toCreateTaskOptions,
};
