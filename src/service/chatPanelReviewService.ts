import type {
  ReviewTabKey,
  UiCommitReviewInput,
  UiReviewDiffFile,
  UiReviewDiffInput,
  UiTask,
} from '../model/task';

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

const createReviewDiffInput = (
  task?: UiTask,
): UiReviewDiffInput | undefined => {
  if (!isReviewTask(task)) {
    return undefined;
  }

  return {
    taskWorkspacePath: task.taskWorkspacePath,
    baseBranchName: task.baseBranchName,
  };
};

const createCommitReviewInput = (
  task: UiTask | undefined,
  reviewCommitMessage: string,
): UiCommitReviewInput | undefined => {
  const message = reviewCommitMessage.trim();
  if (!isReviewTask(task) || !message) {
    return undefined;
  }

  return {
    taskWorkspacePath: task.taskWorkspacePath,
    message,
  };
};

const startReviewDiffLoading = (state: ReviewPanelState): ReviewPanelState => ({
  ...state,
  isReviewDiffLoading: true,
  reviewError: null,
});

const finishReviewDiffLoading = (
  state: ReviewPanelState,
  reviewDiffFiles: UiReviewDiffFile[],
): ReviewPanelState => ({
  ...state,
  reviewDiffFiles,
  isReviewDiffLoading: false,
});

const failReviewDiffLoading = (
  state: ReviewPanelState,
  reviewError: string,
): ReviewPanelState => ({
  ...state,
  reviewDiffFiles: [],
  isReviewDiffLoading: false,
  reviewError,
});

const setReviewTab = (
  state: ReviewPanelState,
  reviewTab: ReviewTabKey,
): ReviewPanelState => ({
  ...state,
  reviewTab,
});

const setReviewCommitMessage = (
  state: ReviewPanelState,
  reviewCommitMessage: string,
): ReviewPanelState => ({
  ...state,
  reviewCommitMessage,
});

const startReviewCommit = (state: ReviewPanelState): ReviewPanelState => ({
  ...state,
  isReviewCommitRunning: true,
  reviewError: null,
});

const finishReviewCommit = (state: ReviewPanelState): ReviewPanelState => ({
  ...state,
  reviewCommitMessage: '',
  isReviewCommitRunning: false,
});

const failReviewCommit = (
  state: ReviewPanelState,
  reviewError: string,
): ReviewPanelState => ({
  ...state,
  isReviewCommitRunning: false,
  reviewError,
});

export const chatPanelReviewService = {
  createReviewPanelState,
  isReviewTask,
  createReviewDiffInput,
  createCommitReviewInput,
  startReviewDiffLoading,
  finishReviewDiffLoading,
  failReviewDiffLoading,
  setReviewTab,
  setReviewCommitMessage,
  startReviewCommit,
  finishReviewCommit,
  failReviewCommit,
};
