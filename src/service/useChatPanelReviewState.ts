import { useEffect, useState } from 'react';
import type {
  ReviewTabKey,
  UiCommitReviewInput,
  UiReviewDiffFile,
  UiReviewDiffInput,
  UiTask,
} from '../model/task';
import { taskRepository } from '../repository/taskRepository';

type ReviewPanelState = {
  reviewTab: ReviewTabKey;
  reviewDiffFiles: UiReviewDiffFile[];
  isReviewDiffLoading: boolean;
  reviewError: string | null;
  reviewCommitMessage: string;
  isReviewCommitRunning: boolean;
};

const createReviewPanelState = (): ReviewPanelState => ({
  reviewTab: 'chat',
  reviewDiffFiles: [],
  isReviewDiffLoading: false,
  reviewError: null,
  reviewCommitMessage: '',
  isReviewCommitRunning: false,
});

const isReviewTask = (task?: UiTask): task is UiTask =>
  task?.lifecycleState === 'awaiting_review';

export const useChatPanelReviewState = (
  activeTask: UiTask | undefined,
  setBootError: (bootError: string | null) => void,
) => {
  const [reviewState, setReviewState] = useState(createReviewPanelState);

  useEffect(() => {
    const input: UiReviewDiffInput | undefined = isReviewTask(activeTask)
      ? {
          taskWorkspacePath: activeTask.taskWorkspacePath,
          baseBranchName: activeTask.baseBranchName,
        }
      : undefined;
    if (!input) {
      setReviewState(createReviewPanelState());
      return;
    }

    let cancelled = false;
    setReviewState((current) => ({
      ...current,
      isReviewDiffLoading: true,
      reviewError: null,
    }));
    void taskRepository
      .getReviewDiff(input)
      .then((files) => {
        if (cancelled) {
          return;
        }

        setReviewState(
          (current): ReviewPanelState => ({
            ...current,
            reviewDiffFiles: files,
            isReviewDiffLoading: false,
          }),
        );
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setReviewState((current) => ({
          ...current,
          reviewDiffFiles: [],
          isReviewDiffLoading: false,
          reviewError:
            error instanceof Error
              ? error.message
              : 'Failed to load review diff.',
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeTask?.baseBranchName,
    activeTask?.lifecycleState,
    activeTask?.taskId,
    activeTask?.taskWorkspacePath,
  ]);

  const handleReviewTabChange = (reviewTab: typeof reviewState.reviewTab) => {
    setReviewState((current) => ({ ...current, reviewTab }));
  };

  const setReviewCommitMessage = (reviewCommitMessage: string) => {
    setReviewState((current) => ({ ...current, reviewCommitMessage }));
  };

  const handleReviewCommit = async () => {
    const message = reviewState.reviewCommitMessage.trim();
    const input: UiCommitReviewInput | undefined =
      isReviewTask(activeTask) && message
        ? {
            taskWorkspacePath: activeTask.taskWorkspacePath,
            message,
          }
        : undefined;
    if (!activeTask || !input) {
      return;
    }

    try {
      setReviewState((current) => ({
        ...current,
        isReviewCommitRunning: true,
        reviewError: null,
      }));
      await taskRepository.commitReview(input);
      await taskRepository.transitionLifecycle({
        taskId: activeTask.taskId,
        nextState: 'completed',
      });
      setReviewState((current) => ({
        ...current,
        reviewCommitMessage: '',
        isReviewCommitRunning: false,
      }));
      setBootError(null);
    } catch (error) {
      setReviewState((current) => ({
        ...current,
        isReviewCommitRunning: false,
        reviewError:
          error instanceof Error ? error.message : 'Failed to commit review.',
      }));
    }
  };

  return {
    reviewTab: reviewState.reviewTab,
    reviewDiffFiles: reviewState.reviewDiffFiles,
    isReviewDiffLoading: reviewState.isReviewDiffLoading,
    reviewError: reviewState.reviewError,
    reviewCommitMessage: reviewState.reviewCommitMessage,
    isReviewCommitRunning: reviewState.isReviewCommitRunning,
    setReviewCommitMessage,
    handleReviewTabChange,
    handleReviewCommit,
  };
};
