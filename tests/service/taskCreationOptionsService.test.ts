import { describe, expect, it } from 'vitest';
import { taskCreationOptionsService } from '../../src/service/taskCreationOptionsService';

describe('taskCreationOptionsService', () => {
  it('defaults to generated branch and review merge enabled', () => {
    expect(taskCreationOptionsService.createDefaultOptions()).toEqual({
      taskBranchName: '',
      reviewMergePolicy: 'merge_to_base',
    });
  });

  it('trims the optional branch name for task creation', () => {
    expect(
      taskCreationOptionsService.toCreateTaskOptions({
        taskBranchName: '  feature/small-pr  ',
        reviewMergePolicy: 'merge_to_base',
      }),
    ).toEqual({
      taskBranchName: 'feature/small-pr',
      reviewMergePolicy: 'preserve_branch',
    });
  });

  it('omits an empty branch name so electron can generate it', () => {
    expect(
      taskCreationOptionsService.toCreateTaskOptions({
        taskBranchName: '   ',
        reviewMergePolicy: 'preserve_branch',
      }),
    ).toEqual({
      taskBranchName: undefined,
      reviewMergePolicy: 'merge_to_base',
    });
  });
});
