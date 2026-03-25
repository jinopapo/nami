import { BrowserWindow, dialog, ipcMain } from 'electron';
import {
  CHAT_CHANNELS,
  type AbortTaskInput,
  type ResumeTaskInput,
  type SendMessageInput,
  type SendMessageResult,
  type SelectDirectoryInput,
  type StartTaskInput,
  type StartTaskResult,
} from '../../core/chat.js';
import { ClineSessionService } from '../service/ClineSessionService.js';
import { WorkspacePreferenceRepository } from '../repository/workspacePreferenceRepository.js';
import {
  createAssistantMessageCompletedEvent,
  createErrorEvent,
  createHumanDecisionRequestEvent,
  createPermissionRequestEvent,
  createSessionTurnUpdateEvent,
  createTaskStartedEvent,
  createTaskStateChangedEvent,
} from './chatEvents.js';

export const registerChatIpc = (window: BrowserWindow, userDataPath: string): ClineSessionService => {
  const service = new ClineSessionService(userDataPath);
  const workspacePreferenceRepository = new WorkspacePreferenceRepository(userDataPath);
  void service.initialize().catch((error) => {
    window.webContents.send(CHAT_CHANNELS.subscribeEvent, createErrorEvent(error instanceof Error ? error.message : 'Failed to initialize agent'));
  });

  service.subscribe((event) => {
    if (event.type === 'session-update') {
      window.webContents.send(CHAT_CHANNELS.subscribeEvent, createSessionTurnUpdateEvent(event.taskId, event.sessionId, event.turnId, event.update));
      return;
    }

    if (event.type === 'permission-request') {
      window.webContents.send(CHAT_CHANNELS.subscribeEvent, createPermissionRequestEvent(event.taskId, event.sessionId, event.turnId, event.approvalId, event.request));
      return;
    }

    if (event.type === 'human-decision-request') {
      window.webContents.send(
        CHAT_CHANNELS.subscribeEvent,
        createHumanDecisionRequestEvent(event.taskId, event.sessionId, event.turnId, event.requestId, event.title, event.description, event.schema),
      );
      return;
    }

    if (event.type === 'assistant-message-completed') {
      window.webContents.send(CHAT_CHANNELS.subscribeEvent, createAssistantMessageCompletedEvent(event.taskId, event.sessionId, event.turnId, event.reason));
      return;
    }

    if (event.type === 'task-started') {
      window.webContents.send(CHAT_CHANNELS.subscribeEvent, createTaskStartedEvent(event.task));
      return;
    }

    if (event.type === 'task-state-changed') {
      window.webContents.send(CHAT_CHANNELS.subscribeEvent, createTaskStateChangedEvent(event.taskId, event.sessionId, event.turnId, event.state, event.reason));
      return;
    }

    const errorEvent = createErrorEvent(event.message, event.sessionId, event.taskId);
    window.webContents.send(CHAT_CHANNELS.subscribeEvent, errorEvent);
  });

  ipcMain.handle(CHAT_CHANNELS.startTask, async (_, input: StartTaskInput): Promise<StartTaskResult> => {
    const task = await service.startTask({ cwd: input.cwd ?? process.cwd(), prompt: input.prompt });
    const turnId = task.activeTurnId ?? task.turns.at(-1)?.turnId;
    if (!turnId) {
      throw new Error('Failed to determine active turn for started task.');
    }
    return { taskId: task.taskId, sessionId: task.sessionId, turnId };
  });
  ipcMain.handle(CHAT_CHANNELS.sendMessage, async (_, input: SendMessageInput): Promise<SendMessageResult> => {
    const result = await service.sendMessage({ taskId: input.taskId, prompt: input.prompt });
    return { taskId: result.taskId, sessionId: result.sessionId, turnId: result.turnId };
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

    const selectedPath = result.canceled ? undefined : result.filePaths[0];
    if (selectedPath) {
      await workspacePreferenceRepository.saveLastSelectedWorkspace(selectedPath);
    }

    return { path: selectedPath };
  });
  ipcMain.handle(CHAT_CHANNELS.getLastSelectedWorkspace, async () => ({
    path: await workspacePreferenceRepository.getLastSelectedWorkspace(),
  }));

  return service;
};
