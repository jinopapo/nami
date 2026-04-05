import type {
  AutoCheckConfig,
  CreateTaskInput,
  CreateTaskResult,
  GetAutoCheckConfigInput,
  GetAutoCheckConfigResult,
  GetLastSelectedWorkspaceResult,
  RunAutoCheckInput,
  RunAutoCheckResult,
  SaveAutoCheckConfigInput,
  SelectDirectoryInput,
  SelectDirectoryResult,
  TaskEvent,
  TaskSummary,
  TransitionTaskLifecycleInput,
} from '../../core/task';
import type { UiTask } from '../model/chat';

type AutoCheckResult = RunAutoCheckResult extends { result: infer TResult }
  ? TResult
  : {
      success: boolean;
      exitCode: number;
      stdout: string;
      stderr: string;
      command: string;
      ranAt: string;
    };

type TaskSummaryWithAutoCheck = TaskSummary & {
  latestAutoCheckResult?: AutoCheckResult;
};

const getTaskApi = () => {
  if (!window.nami?.task) {
    throw new Error('Electron preload bridge is unavailable.');
  }

  return window.nami.task;
};

const toUiTask = (task: TaskSummary): UiTask => ({
  taskId: task.taskId,
  sessionId: task.sessionId,
  cwd: task.cwd,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  mode: task.mode,
  lifecycleState: task.lifecycleState,
  runtimeState: task.runtimeState,
  latestAutoCheckResult: (task as TaskSummaryWithAutoCheck).latestAutoCheckResult,
});

export const taskRepository = {
  create: (input: CreateTaskInput): Promise<CreateTaskResult> => getTaskApi().create(input),
  transitionLifecycle: (input: TransitionTaskLifecycleInput): Promise<void> => getTaskApi().transitionLifecycle(input),
  selectDirectory: (input?: SelectDirectoryInput): Promise<SelectDirectoryResult> => getTaskApi().selectDirectory(input),
  getLastSelectedWorkspace: (): Promise<GetLastSelectedWorkspaceResult> => getTaskApi().getLastSelectedWorkspace(),
  getAutoCheckConfig: async (input: GetAutoCheckConfigInput): Promise<AutoCheckConfig> => {
    const result: GetAutoCheckConfigResult = await getTaskApi().getAutoCheckConfig(input);
    return result.config;
  },
  saveAutoCheckConfig: (input: SaveAutoCheckConfigInput): Promise<void> => getTaskApi().saveAutoCheckConfig(input),
  runAutoCheck: async (input: RunAutoCheckInput): Promise<AutoCheckResult> => {
    const result = await getTaskApi().runAutoCheck(input) as RunAutoCheckResult & { result?: AutoCheckResult };
    if ('result' in result && result.result) {
      return result.result;
    }

    return result as unknown as AutoCheckResult;
  },
  subscribeEvents: (listener: (event: TaskEvent) => void): (() => void) => getTaskApi().subscribeEvents(listener),
  toUiTask,
};