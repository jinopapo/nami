import { BrowserWindow, ipcMain } from 'electron';
import {
  CHAT_CHANNELS,
  type AbortTaskInput,
  type ResumeTaskInput,
  type SendMessageInput,
  type SendMessageResult,
} from '../../core/chat.js';
import { ClineSessionService } from '../service/ClineSessionService.js';
import {
  createAssistantMessageCompletedEvent,
  createChatRuntimeStateChangedEvent,
  createErrorEvent,
  createHumanDecisionRequestEvent,
  createPermissionRequestEvent,
  createSessionTurnUpdateEvent,
} from './chatEvents.js';

export const registerChatIpc = (
  window: BrowserWindow,
  userDataPath: string,
): ClineSessionService => {
  const service = new ClineSessionService(userDataPath);
  void service.initialize().catch((error) => {
    window.webContents.send(
      CHAT_CHANNELS.subscribeEvent,
      createErrorEvent(
        error instanceof Error ? error.message : 'Failed to initialize agent',
      ),
    );
  });

  service.subscribe((event) => {
    if (event.type === 'session-update') {
      window.webContents.send(
        CHAT_CHANNELS.subscribeEvent,
        createSessionTurnUpdateEvent(
          event.taskId,
          event.sessionId,
          event.turnId,
          event.update,
        ),
      );
      return;
    }

    if (event.type === 'permission-request') {
      window.webContents.send(
        CHAT_CHANNELS.subscribeEvent,
        createPermissionRequestEvent(
          event.taskId,
          event.sessionId,
          event.turnId,
          event.approvalId,
          event.request,
        ),
      );
      return;
    }

    if (event.type === 'human-decision-request') {
      window.webContents.send(
        CHAT_CHANNELS.subscribeEvent,
        createHumanDecisionRequestEvent(
          event.taskId,
          event.sessionId,
          event.turnId,
          event.requestId,
          event.title,
          event.description,
          event.schema,
        ),
      );
      return;
    }

    if (event.type === 'assistant-message-completed') {
      window.webContents.send(
        CHAT_CHANNELS.subscribeEvent,
        createAssistantMessageCompletedEvent(
          event.taskId,
          event.sessionId,
          event.turnId,
          event.reason,
        ),
      );
      return;
    }

    if (event.type === 'chat-runtime-state-changed') {
      window.webContents.send(
        CHAT_CHANNELS.subscribeEvent,
        createChatRuntimeStateChangedEvent(
          event.taskId,
          event.sessionId,
          event.turnId,
          event.state,
          event.reason,
        ),
      );
      return;
    }

    if (
      event.type === 'task-created' ||
      event.type === 'task-lifecycle-state-changed'
    ) {
      return;
    }

    const errorEvent = createErrorEvent(
      event.message,
      event.sessionId,
      event.taskId,
    );
    window.webContents.send(CHAT_CHANNELS.subscribeEvent, errorEvent);
  });

  ipcMain.handle(
    CHAT_CHANNELS.sendMessage,
    async (_, input: SendMessageInput): Promise<SendMessageResult> => {
      const result = await service.sendMessage({
        taskId: input.taskId,
        prompt: input.prompt,
      });
      return {
        taskId: result.taskId,
        sessionId: result.sessionId,
        turnId: result.turnId,
      };
    },
  );
  ipcMain.handle(CHAT_CHANNELS.abortTask, async (_, input: AbortTaskInput) => {
    await service.abortTask(input.taskId);
  });
  ipcMain.handle(
    CHAT_CHANNELS.resumeTask,
    async (_, input: ResumeTaskInput) => {
      service.resumeTask(input);
    },
  );

  return service;
};
