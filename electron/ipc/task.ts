import { BrowserWindow, dialog, ipcMain } from 'electron';
import {
  type AutoCheckFeedbackEvent,
  type AutoCheckResult,
  type AutoCheckRunSummary,
  type AutoCheckStepEvent,
  type CreateTaskInput,
  type CreateTaskResult,
  type GetAutoCheckConfigInput,
  type GetAutoCheckConfigResult,
  type TaskEvent,
  type TaskSummary,
  type TaskLifecycleState,
  type RunAutoCheckInput,
  type RunAutoCheckResult,
  type SaveAutoCheckConfigInput,
  type SelectDirectoryInput,
  type TransitionTaskLifecycleInput,
} from '../../core/task.js';
import { WorkspacePreferenceRepository } from '../repository/workspacePreferenceRepository.js';
import { WorkspaceAutoCheckService } from '../service/WorkspaceAutoCheckService.js';

const TASK_CHANNELS = {
  create: 'task:create',
  transitionLifecycle: 'task:transitionLifecycle',
  selectDirectory: 'task:selectDirectory',
  getLastSelectedWorkspace: 'task:getLastSelectedWorkspace',
  getAutoCheckConfig: 'task:getAutoCheckConfig',
  saveAutoCheckConfig: 'task:saveAutoCheckConfig',
  runAutoCheck: 'task:runAutoCheck',
  subscribeEvent: 'task:event',
} as const;

type TaskRecordSnapshot = {
  taskId: string;
  sessionId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  lifecycleState: TaskLifecycleState;
  runtimeState: TaskSummary['runtimeState'];
  latestAutoCheckResult?: TaskSummary['latestAutoCheckResult'];
};

const now = () => new Date().toISOString();

const toTaskSummary = (task: TaskRecordSnapshot): TaskSummary => ({
  taskId: task.taskId,
  sessionId: task.sessionId,
  cwd: task.cwd,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  mode: task.mode,
  lifecycleState: task.lifecycleState,
  runtimeState: task.runtimeState,
  latestAutoCheckResult: task.latestAutoCheckResult,
});

const createTaskCreatedEvent = (task: TaskRecordSnapshot): TaskEvent => ({
  type: 'taskCreated',
  task: toTaskSummary(task),
  timestamp: now(),
});

const createTaskLifecycleStateChangedEvent = (
  taskId: string,
  sessionId: string,
  state: TaskLifecycleState,
  reason?: string,
  mode?: 'plan' | 'act',
  autoCheckResult?: TaskSummary['latestAutoCheckResult'],
): TaskEvent => ({
  type: 'taskLifecycleStateChanged',
  taskId,
  sessionId,
  timestamp: now(),
  state,
  mode,
  reason,
  autoCheckResult,
});

const createAutoCheckStartedEvent = (
  taskId: string,
  sessionId: string,
  run: AutoCheckRunSummary,
): TaskEvent => ({
  type: 'autoCheckStarted',
  taskId,
  sessionId,
  timestamp: now(),
  run,
});

const createAutoCheckStepEvent = (
  taskId: string,
  sessionId: string,
  step: AutoCheckStepEvent,
): TaskEvent => ({
  type: 'autoCheckStep',
  taskId,
  sessionId,
  timestamp: now(),
  step,
});

const createAutoCheckCompletedEvent = (
  taskId: string,
  sessionId: string,
  autoCheckRunId: string,
  result: AutoCheckResult,
): TaskEvent => ({
  type: 'autoCheckCompleted',
  taskId,
  sessionId,
  timestamp: now(),
  autoCheckRunId,
  result,
});

const createAutoCheckFeedbackPreparedEvent = (
  taskId: string,
  sessionId: string,
  feedback: AutoCheckFeedbackEvent,
): TaskEvent => ({
  type: 'autoCheckFeedbackPrepared',
  taskId,
  sessionId,
  timestamp: now(),
  feedback,
});

type TaskOrchestrator = {
  subscribe(listener: (event: any) => void): () => void;
  startTask(input: {
    cwd: string;
    prompt: string;
  }): Promise<import('../entity/clineSession.js').TaskRuntime>;
  transitionTaskLifecycle(input: TransitionTaskLifecycleInput): void;
};

export const registerTaskIpc = (
  window: BrowserWindow,
  userDataPath: string,
  orchestrator: TaskOrchestrator,
): void => {
  const workspacePreferenceRepository = new WorkspacePreferenceRepository(
    userDataPath,
  );
  const workspaceAutoCheckService = new WorkspaceAutoCheckService(userDataPath);

  orchestrator.subscribe((event) => {
    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'task-created'
    ) {
      window.webContents.send(
        TASK_CHANNELS.subscribeEvent,
        createTaskCreatedEvent(event.task),
      );
      return;
    }

    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'task-lifecycle-state-changed'
    ) {
      window.webContents.send(
        TASK_CHANNELS.subscribeEvent,
        createTaskLifecycleStateChangedEvent(
          event.taskId,
          event.sessionId,
          event.state,
          event.reason,
          event.mode,
          event.autoCheckResult,
        ),
      );
      return;
    }

    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'auto-check-started'
    ) {
      window.webContents.send(
        TASK_CHANNELS.subscribeEvent,
        createAutoCheckStartedEvent(event.taskId, event.sessionId, event.run),
      );
      return;
    }

    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'auto-check-step'
    ) {
      window.webContents.send(
        TASK_CHANNELS.subscribeEvent,
        createAutoCheckStepEvent(event.taskId, event.sessionId, event.step),
      );
      return;
    }

    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'auto-check-completed'
    ) {
      window.webContents.send(
        TASK_CHANNELS.subscribeEvent,
        createAutoCheckCompletedEvent(
          event.taskId,
          event.sessionId,
          event.autoCheckRunId,
          event.result,
        ),
      );
      return;
    }

    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'auto-check-feedback-prepared'
    ) {
      window.webContents.send(
        TASK_CHANNELS.subscribeEvent,
        createAutoCheckFeedbackPreparedEvent(
          event.taskId,
          event.sessionId,
          event.feedback,
        ),
      );
    }
  });

  ipcMain.handle(
    TASK_CHANNELS.create,
    async (_, input: CreateTaskInput): Promise<CreateTaskResult> => {
      const task = await orchestrator.startTask({
        cwd: input.cwd ?? process.cwd(),
        prompt: input.prompt,
      });
      const turnId = task.activeTurnId ?? task.turns.at(-1)?.turnId;
      return turnId
        ? { taskId: task.taskId, sessionId: task.sessionId, turnId }
        : { taskId: task.taskId, sessionId: task.sessionId };
    },
  );

  ipcMain.handle(
    TASK_CHANNELS.transitionLifecycle,
    async (_, input: TransitionTaskLifecycleInput) => {
      orchestrator.transitionTaskLifecycle(input);
    },
  );

  ipcMain.handle(
    TASK_CHANNELS.selectDirectory,
    async (_, input: SelectDirectoryInput | undefined) => {
      const result = await dialog.showOpenDialog(window, {
        title: 'Choose workspace directory',
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: input?.defaultPath,
      });

      const selectedPath = result.canceled ? undefined : result.filePaths[0];
      if (selectedPath) {
        await workspacePreferenceRepository.saveLastSelectedWorkspace(
          selectedPath,
        );
      }

      return { path: selectedPath };
    },
  );

  ipcMain.handle(TASK_CHANNELS.getLastSelectedWorkspace, async () => ({
    path: await workspacePreferenceRepository.getLastSelectedWorkspace(),
  }));

  ipcMain.handle(
    TASK_CHANNELS.getAutoCheckConfig,
    async (
      _,
      input: GetAutoCheckConfigInput,
    ): Promise<GetAutoCheckConfigResult> => ({
      config: await workspaceAutoCheckService.getConfig(input.cwd),
    }),
  );

  ipcMain.handle(
    TASK_CHANNELS.saveAutoCheckConfig,
    async (_, input: SaveAutoCheckConfigInput): Promise<void> => {
      await workspaceAutoCheckService.saveConfig(input.cwd, input.config);
    },
  );

  ipcMain.handle(
    TASK_CHANNELS.runAutoCheck,
    async (_, input: RunAutoCheckInput): Promise<RunAutoCheckResult> => ({
      result: await workspaceAutoCheckService.run(input.cwd, input.config),
    }),
  );
};
