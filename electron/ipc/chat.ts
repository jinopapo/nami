import { BrowserWindow, ipcMain } from 'electron';
import {
  CHAT_CHANNELS,
  type AbortTaskInput,
  type ResumeTaskInput,
  type SendMessageInput,
  type SendMessageResult,
} from '../../core/chat.js';
import {
  createAssistantMessageCompletedEvent,
  createChatRuntimeStateChangedEvent,
  createErrorEvent,
  createHumanDecisionRequestEvent,
  createPermissionRequestEvent,
  createSessionTurnUpdateEvent,
} from './chatEvents.js';

type ChatOrchestrator = {
  initialize(): Promise<void>;
  subscribe(listener: (event: any) => void): () => void;
  sendMessage(input: {
    taskId: string;
    prompt: string;
  }): Promise<SendMessageResult>;
  abortTask(taskId: string): Promise<void>;
  resumeTask(input: ResumeTaskInput): void;
};

export const registerChatIpc = (
  window: BrowserWindow,
  orchestrator: ChatOrchestrator,
): void => {
  void orchestrator.initialize().catch((error) => {
    window.webContents.send(
      CHAT_CHANNELS.subscribeEvent,
      createErrorEvent(
        error instanceof Error ? error.message : 'Failed to initialize agent',
      ),
    );
  });

  orchestrator.subscribe((event) => {
    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'session-update'
    ) {
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

    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'permission-request'
    ) {
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

    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'human-decision-request'
    ) {
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

    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'assistant-message-completed'
    ) {
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

    if (
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      event.type === 'chat-runtime-state-changed'
    ) {
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
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      (event.type === 'task-created' ||
        event.type === 'task-lifecycle-state-changed')
    ) {
      return;
    }

    if (
      typeof event !== 'object' ||
      event === null ||
      !('type' in event) ||
      event.type !== 'error'
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
      const result = await orchestrator.sendMessage({
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
    await orchestrator.abortTask(input.taskId);
  });
  ipcMain.handle(
    CHAT_CHANNELS.resumeTask,
    async (_, input: ResumeTaskInput) => {
      orchestrator.resumeTask(input);
    },
  );
};
