import type {
  AutoCheckConfig,
  CommitReviewInput,
  CommitReviewResult,
  CreateTaskInput,
  CreateTaskResult,
  GetCurrentBranchInput,
  GetCurrentBranchResult,
  GetAutoCheckConfigInput,
  GetAutoCheckConfigResult,
  GetReviewDiffInput,
  GetReviewDiffResult,
  RunAutoCheckInput,
  RunAutoCheckResult,
  SaveAutoCheckConfigInput,
  SelectDirectoryInput,
  TaskEvent,
  TransitionTaskLifecycleInput,
} from '../../share/task';

type AutoCheckResult = RunAutoCheckResult extends { result: infer TResult }
  ? TResult
  : {
      success: boolean;
      exitCode: number;
      output: string;
      command: string;
      ranAt: string;
    };

const getTaskApi = () => {
  if (!window.nami?.task) {
    throw new Error('Electron preload bridge is unavailable.');
  }

  return window.nami.task;
};

export const taskRepository = {
  create: (input: CreateTaskInput): Promise<CreateTaskResult> =>
    getTaskApi().create(input),
  transitionLifecycle: (input: TransitionTaskLifecycleInput): Promise<void> =>
    getTaskApi().transitionLifecycle(input),
  selectDirectory: (input?: SelectDirectoryInput): Promise<{ path?: string }> =>
    getTaskApi().selectDirectory(input),
  getLastSelectedWorkspace: (): Promise<{ path?: string }> =>
    getTaskApi().getLastSelectedWorkspace(),
  getCurrentBranch: async (input: GetCurrentBranchInput): Promise<string> => {
    const result: GetCurrentBranchResult =
      await getTaskApi().getCurrentBranch(input);
    return result.branch;
  },
  getReviewDiff: async (
    input: GetReviewDiffInput,
  ): Promise<GetReviewDiffResult['files']> => {
    const result: GetReviewDiffResult = await getTaskApi().getReviewDiff(input);
    return result.files;
  },
  commitReview: (input: CommitReviewInput): Promise<CommitReviewResult> =>
    getTaskApi().commitReview(input),
  getAutoCheckConfig: async (
    input: GetAutoCheckConfigInput,
  ): Promise<AutoCheckConfig> => {
    const result: GetAutoCheckConfigResult =
      await getTaskApi().getAutoCheckConfig(input);
    return result.config;
  },
  saveAutoCheckConfig: (input: SaveAutoCheckConfigInput): Promise<void> =>
    getTaskApi().saveAutoCheckConfig(input),
  runAutoCheck: async (input: RunAutoCheckInput): Promise<AutoCheckResult> => {
    const result = (await getTaskApi().runAutoCheck(
      input,
    )) as RunAutoCheckResult & { result?: AutoCheckResult };
    if ('result' in result && result.result) {
      return result.result;
    }

    return result as unknown as AutoCheckResult;
  },
  subscribeEvents: (listener: (event: TaskEvent) => void): (() => void) =>
    getTaskApi().subscribeEvents(listener),
};
