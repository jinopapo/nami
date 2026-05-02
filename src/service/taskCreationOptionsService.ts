import type { UiTaskCreationOptions } from '../model/task';

const createDefaultOptions = (): UiTaskCreationOptions => ({
  taskBranchName: '',
  reviewMergePolicy: 'merge_to_base',
  dependencyTaskIds: [],
});

const toCreateTaskOptions = (
  options: UiTaskCreationOptions,
): {
  taskBranchName?: string;
  reviewMergePolicy: UiTaskCreationOptions['reviewMergePolicy'];
  dependencyTaskIds: string[];
} => {
  const taskBranchName = options.taskBranchName.trim();

  return {
    taskBranchName: taskBranchName || undefined,
    reviewMergePolicy: taskBranchName ? 'preserve_branch' : 'merge_to_base',
    dependencyTaskIds: taskBranchName ? [] : options.dependencyTaskIds,
  };
};

// eslint-disable-next-line no-grouped-exports/no-exported-function-object -- Existing service object; clean up separately.
export const taskCreationOptionsService = {
  createDefaultOptions,
  toCreateTaskOptions,
};
