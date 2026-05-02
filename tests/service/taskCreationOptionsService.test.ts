import { describe, expect, it } from 'vitest';
import { taskCreationOptionsService } from '../../src/service/taskCreationOptionsService';

describe('taskCreationOptionsService', () => {
  it('defaults to generated branch and review merge enabled', () => {
    expect(taskCreationOptionsService.createDefaultOptions()).toEqual({
      taskBranchName: '',
      reviewMergePolicy: 'merge_to_base',
      dependencyTaskIds: [],
    });
  });

  it('trims the optional branch name for task creation', () => {
    expect(
      taskCreationOptionsService.toCreateTaskOptions({
        taskBranchName: '  feature/small-pr  ',
        reviewMergePolicy: 'merge_to_base',
        dependencyTaskIds: ['task-a'],
      }),
    ).toEqual({
      taskBranchName: 'feature/small-pr',
      reviewMergePolicy: 'preserve_branch',
      dependencyTaskIds: [],
    });
  });

  it('omits an empty branch name so electron can generate it', () => {
    expect(
      taskCreationOptionsService.toCreateTaskOptions({
        taskBranchName: '   ',
        reviewMergePolicy: 'preserve_branch',
        dependencyTaskIds: ['task-a', 'task-b'],
      }),
    ).toEqual({
      taskBranchName: undefined,
      reviewMergePolicy: 'merge_to_base',
      dependencyTaskIds: ['task-a', 'task-b'],
    });
  });
});
