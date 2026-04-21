/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_ipc'. Dependency is of type 'electron_repository' */
import { BrowserWindow, dialog, ipcMain, type WebContents } from 'electron';
import {
  type CommitReviewInput,
  type CommitReviewResult,
  type CreateTaskInput,
  type CreateTaskResult,
  type GetCurrentBranchInput,
  type GetCurrentBranchResult,
  type GetAutoCheckConfigInput,
  type GetAutoCheckConfigResult,
  type GetReviewDiffInput,
  type GetReviewDiffResult,
  type RunAutoCheckInput,
  type RunAutoCheckResult,
  type SaveAutoCheckConfigInput,
  type SelectDirectoryInput,
  type TransitionTaskLifecycleInput,
} from '../../share/task.js';
import {
  createAutoCheckCompletedEvent,
  createAutoCheckFeedbackPreparedEvent,
  createAutoCheckStartedEvent,
  createAutoCheckStepEvent,
  createTaskCreatedEvent,
  createTaskLifecycleStateChangedEvent,
} from '../mapper/taskEventMapper.js';
import { WorkspacePreferenceRepository } from '../repository/workspacePreferenceRepository.js';
import { TaskWorkspaceService } from '../service/TaskWorkspaceService.js';
import { WorkspaceAutoCheckService } from '../service/WorkspaceAutoCheckService.js';

const TASK_CHANNELS = {
  create: 'task:create',
  transitionLifecycle: 'task:transitionLifecycle',
  selectDirectory: 'task:selectDirectory',
  getLastSelectedWorkspace: 'task:getLastSelectedWorkspace',
  getCurrentBranch: 'task:getCurrentBranch',
  getReviewDiff: 'task:getReviewDiff',
  commitReview: 'task:commitReview',
  getAutoCheckConfig: 'task:getAutoCheckConfig',
  saveAutoCheckConfig: 'task:saveAutoCheckConfig',
  runAutoCheck: 'task:runAutoCheck',
  subscribeEvent: 'task:event',
} as const;

type TaskOrchestrator = {
  subscribe(listener: (event: any) => void): () => void;
  startTask(input: {
    cwd: string;
    prompt: string;
  }): Promise<import('../entity/clineSession.js').TaskRuntime>;
  transitionTaskLifecycle(input: TransitionTaskLifecycleInput): Promise<void>;
};

export const registerTaskIpc = (
  userDataPath: string,
  resolveContext: (sender: WebContents) =>
    | {
        window: BrowserWindow;
        orchestrator: TaskOrchestrator;
      }
    | undefined,
): void => {
  const workspacePreferenceRepository = new WorkspacePreferenceRepository(
    userDataPath,
  );
  const taskWorkspaceService = new TaskWorkspaceService();
  const workspaceAutoCheckService = new WorkspaceAutoCheckService(userDataPath);

  ipcMain.handle(
    TASK_CHANNELS.create,
    async (_, input: CreateTaskInput): Promise<CreateTaskResult> => {
      const context = resolveContext(_.sender);
      if (!context) {
        throw new Error('Window context not found for task creation.');
      }

      const task = await context.orchestrator.startTask({
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
      const context = resolveContext(_.sender);
      if (!context) {
        throw new Error('Window context not found for lifecycle transition.');
      }

      await context.orchestrator.transitionTaskLifecycle(input);
    },
  );

  ipcMain.handle(
    TASK_CHANNELS.selectDirectory,
    async (_, input: SelectDirectoryInput | undefined) => {
      const context = resolveContext(_.sender);
      if (!context) {
        throw new Error('Window context not found for directory selection.');
      }

      const result = await dialog.showOpenDialog(context.window, {
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
    TASK_CHANNELS.getCurrentBranch,
    async (
      _,
      input: GetCurrentBranchInput,
    ): Promise<GetCurrentBranchResult> => ({
      branch: await taskWorkspaceService.getCurrentBranch(input.cwd),
    }),
  );

  ipcMain.handle(
    TASK_CHANNELS.getReviewDiff,
    async (_, input: GetReviewDiffInput): Promise<GetReviewDiffResult> => ({
      files: await taskWorkspaceService.getReviewDiff(input),
    }),
  );

  ipcMain.handle(
    TASK_CHANNELS.commitReview,
    async (_, input: CommitReviewInput): Promise<CommitReviewResult> =>
      taskWorkspaceService.commitReview(input),
  );

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

const sendToWindow = (window: BrowserWindow, payload: unknown): void => {
  if (window.isDestroyed()) {
    return;
  }

  window.webContents.send(TASK_CHANNELS.subscribeEvent, payload);
};

export const bindTaskEvents = (
  window: BrowserWindow,
  orchestrator: TaskOrchestrator,
): (() => void) => {
  return orchestrator.subscribe((event) => {
    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'task-created'
    ) {
      sendToWindow(window, createTaskCreatedEvent(event.task));
      return;
    }

    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'task-lifecycle-state-changed'
    ) {
      sendToWindow(
        window,
        createTaskLifecycleStateChangedEvent(
          event.taskId,
          event.sessionId,
          event.state,
          event.reason,
          event.mode,
          {
            projectWorkspacePath: event.projectWorkspacePath,
            taskWorkspacePath: event.taskWorkspacePath,
            taskBranchName: event.taskBranchName,
            baseBranchName: event.baseBranchName,
            workspaceStatus: event.workspaceStatus,
            mergeStatus: event.mergeStatus,
            mergeFailureReason: event.mergeFailureReason,
            mergeMessage: event.mergeMessage,
          },
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
      sendToWindow(
        window,
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
      sendToWindow(
        window,
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
      sendToWindow(
        window,
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
      sendToWindow(
        window,
        createAutoCheckFeedbackPreparedEvent(
          event.taskId,
          event.sessionId,
          event.feedback,
        ),
      );
    }
  });
};
