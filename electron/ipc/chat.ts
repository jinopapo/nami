import { BrowserWindow, dialog, ipcMain } from 'electron';
import {
  CHAT_CHANNELS,
  type AbortTaskInput,
  type ResumeTaskInput,
  type SelectDirectoryInput,
  type StartTaskInput,
  type StartTaskResult,
} from '../../core/chat.js';
import { ClineSessionService } from '../service/ClineSessionService.js';
import {
  createErrorEvent,
  createHumanDecisionRequestEvent,
  createPermissionRequestEvent,
  createRawSessionUpdateEvent,
  createTaskStartedEvent,
  createTaskStateChangedEvent,
} from './chatEvents.js';

export const registerChatIpc = (window: BrowserWindow, userDataPath: string): ClineSessionService => {
  const service = new ClineSessionService(userDataPath);
  void service.initialize().catch((error) => {
    window.webContents.send(CHAT_CHANNELS.subscribeEvent, createErrorEvent(error instanceof Error ? error.message : 'Failed to initialize agent'));
  });

  service.subscribe((event) => {
    if (event.type === 'session-update') {
      window.webContents.send(CHAT_CHANNELS.subscribeEvent, createRawSessionUpdateEvent(event.taskId, event.sessionId, event.update));
      return;
    }

    if (event.type === 'permission-request') {
      window.webContents.send(CHAT_CHANNELS.subscribeEvent, createPermissionRequestEvent(event.taskId, event.sessionId, event.approvalId, event.request));
      return;
    }

    if (event.type === 'human-decision-request') {
      window.webContents.send(
        CHAT_CHANNELS.subscribeEvent,
        createHumanDecisionRequestEvent(event.taskId, event.sessionId, event.requestId, event.title, event.description, event.schema),
      );
      return;
    }

    if (event.type === 'task-started') {
      window.webContents.send(CHAT_CHANNELS.subscribeEvent, createTaskStartedEvent(event.task));
      return;
    }

    if (event.type === 'task-state-changed') {
      window.webContents.send(CHAT_CHANNELS.subscribeEvent, createTaskStateChangedEvent(event.taskId, event.sessionId, event.state, event.reason));
      return;
    }

    const errorEvent = createErrorEvent(event.message, event.sessionId, event.taskId);
    window.webContents.send(CHAT_CHANNELS.subscribeEvent, errorEvent);
  });

  ipcMain.handle(CHAT_CHANNELS.startTask, async (_, input: StartTaskInput): Promise<StartTaskResult> => {
    const task = await service.startTask({ cwd: input.cwd ?? process.cwd(), prompt: input.prompt });
    return { taskId: task.taskId, sessionId: task.sessionId };
  });
  ipcMain.handle(CHAT_CHANNELS.abortTask, async (_, input: AbortTaskInput) => {
    await service.abortTask(input.taskId);
  });
  ipcMain.handle(CHAT_CHANNELS.resumeTask, async (_, input: ResumeTaskInput) => {
    service.resumeTask(input);
  });
  ipcMain.handle(CHAT_CHANNELS.selectDirectory, async (_, input: SelectDirectoryInput | undefined) => {
    const result = await dialog.showOpenDialog(window, {
      title: 'Choose workspace directory',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: input?.defaultPath,
    });

    return { path: result.canceled ? undefined : result.filePaths[0] };
  });

  return service;
};
