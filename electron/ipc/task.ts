import { BrowserWindow, dialog, ipcMain } from 'electron';
import {
  TASK_CHANNELS,
  type CreateTaskInput,
  type CreateTaskResult,
  type SelectDirectoryInput,
  type TransitionTaskLifecycleInput,
} from '../../core/task.js';
import { WorkspacePreferenceRepository } from '../repository/workspacePreferenceRepository.js';
import { ClineSessionService } from '../service/ClineSessionService.js';
import { createTaskCreatedEvent, createTaskLifecycleStateChangedEvent } from './taskEvents.js';

export const registerTaskIpc = (window: BrowserWindow, userDataPath: string, service: ClineSessionService): void => {
  const workspacePreferenceRepository = new WorkspacePreferenceRepository(userDataPath);

  service.subscribe((event) => {
    if (event.type === 'task-created') {
      window.webContents.send(TASK_CHANNELS.subscribeEvent, createTaskCreatedEvent(event.task));
      return;
    }

    if (event.type === 'task-lifecycle-state-changed') {
      window.webContents.send(TASK_CHANNELS.subscribeEvent, createTaskLifecycleStateChangedEvent(event.taskId, event.sessionId, event.state, event.reason, event.mode));
    }
  });

  ipcMain.handle(TASK_CHANNELS.create, async (_, input: CreateTaskInput): Promise<CreateTaskResult> => {
    const task = await service.startTask({ cwd: input.cwd ?? process.cwd(), prompt: input.prompt });
    const turnId = task.activeTurnId ?? task.turns.at(-1)?.turnId;
    if (!turnId) {
      throw new Error('Failed to determine active turn for started task.');
    }
    return { taskId: task.taskId, sessionId: task.sessionId, turnId };
  });

  ipcMain.handle(TASK_CHANNELS.transitionLifecycle, async (_, input: TransitionTaskLifecycleInput) => {
    service.transitionTaskLifecycle(input);
  });

  ipcMain.handle(TASK_CHANNELS.selectDirectory, async (_, input: SelectDirectoryInput | undefined) => {
    const result = await dialog.showOpenDialog(window, {
      title: 'Choose workspace directory',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: input?.defaultPath,
    });

    const selectedPath = result.canceled ? undefined : result.filePaths[0];
    if (selectedPath) {
      await workspacePreferenceRepository.saveLastSelectedWorkspace(selectedPath);
    }

    return { path: selectedPath };
  });

  ipcMain.handle(TASK_CHANNELS.getLastSelectedWorkspace, async () => ({
    path: await workspacePreferenceRepository.getLastSelectedWorkspace(),
  }));
};