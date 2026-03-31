import type {
  CreateTaskInput,
  CreateTaskResult,
  GetLastSelectedWorkspaceResult,
  SelectDirectoryInput,
  SelectDirectoryResult,
  TaskEvent,
  TaskSummary,
  TransitionTaskLifecycleInput,
} from '../../core/task';
import type { UiTask } from '../model/chat';

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
});

export const taskRepository = {
  create: (input: CreateTaskInput): Promise<CreateTaskResult> => getTaskApi().create(input),
  transitionLifecycle: (input: TransitionTaskLifecycleInput): Promise<void> => getTaskApi().transitionLifecycle(input),
  selectDirectory: (input?: SelectDirectoryInput): Promise<SelectDirectoryResult> => getTaskApi().selectDirectory(input),
  getLastSelectedWorkspace: (): Promise<GetLastSelectedWorkspaceResult> => getTaskApi().getLastSelectedWorkspace(),
  subscribeEvents: (listener: (event: TaskEvent) => void): (() => void) => getTaskApi().subscribeEvents(listener),
  toUiTask,
};