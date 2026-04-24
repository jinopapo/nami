import { describe, expect, it } from 'vitest';
import { taskCreationOptionsService } from './taskCreationOptionsService';

describe('taskCreationOptionsService', () => {
  it('defaults to generated branch and review merge enabled', () => {
    expect(taskCreationOptionsService.createDefaultOptions()).toEqual({
      taskBranchName: '',
      shouldMergeAfterReview: true,
    });
  });

  it('trims the optional branch name for task creation', () => {
    expect(
      taskCreationOptionsService.toCreateTaskOptions({
        taskBranchName: '  feature/small-pr  ',
        shouldMergeAfterReview: false,
      }),
    ).toEqual({
      taskBranchName: 'feature/small-pr',
      shouldMergeAfterReview: false,
    });
  });

  it('omits an empty branch name so electron can generate it', () => {
    expect(
      taskCreationOptionsService.toCreateTaskOptions({
        taskBranchName: '   ',
        shouldMergeAfterReview: true,
      }),
    ).toEqual({
      taskBranchName: undefined,
      shouldMergeAfterReview: true,
    });
  });
});
