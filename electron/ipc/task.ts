import { BrowserWindow, dialog, ipcMain } from 'electron';
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
} from '../../core/task.js';
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
  const taskWorkspaceService = new TaskWorkspaceService();
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
