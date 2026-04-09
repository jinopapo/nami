import { BrowserWindow, ipcMain } from 'electron';
import type { RequestPermissionRequest, SessionUpdate } from 'cline';
import {
  type AbortTaskInput,
  type ChatEvent,
  type ChatRuntimeState,
  type ResumeTaskInput,
  type SendMessageInput,
  type SendMessageResult,
} from '../../core/chat.js';

const CHAT_CHANNELS = {
  sendMessage: 'chat:sendMessage',
  abortTask: 'chat:abortTask',
  resumeTask: 'chat:resumeTask',
  subscribeEvent: 'chat:event',
} as const;

const now = () => new Date().toISOString();

const createErrorEvent = (
  message: string,
  sessionId?: string,
  taskId?: string,
): ChatEvent => ({
  type: 'error',
  taskId,
  sessionId,
  timestamp: now(),
  message,
});

const createSessionTurnUpdateEvent = (
  taskId: string,
  sessionId: string,
  turnId: string | undefined,
  update: SessionUpdate,
): ChatEvent => ({
  type: 'sessionUpdate',
  taskId,
  sessionId,
  turnId,
  timestamp: now(),
  update,
});

const createPermissionRequestEvent = (
  taskId: string,
  sessionId: string,
  turnId: string,
  approvalId: string,
  request: RequestPermissionRequest,
): ChatEvent => ({
  type: 'permissionRequest',
  taskId,
  sessionId,
  turnId,
  timestamp: now(),
  approvalId,
  request,
});

const createHumanDecisionRequestEvent = (
  taskId: string,
  sessionId: string,
  turnId: string,
  requestId: string,
  title: string,
  description?: string,
  schema?: unknown,
): ChatEvent => ({
  type: 'humanDecisionRequest',
  taskId,
  sessionId,
  turnId,
  timestamp: now(),
  requestId,
  title,
  description,
  schema,
});

const createAssistantMessageCompletedEvent = (
  taskId: string,
  sessionId: string,
  turnId: string,
  reason?: string,
): ChatEvent => ({
  type: 'assistantMessageCompleted',
  taskId,
  sessionId,
  turnId,
  timestamp: now(),
  reason,
});

const createChatRuntimeStateChangedEvent = (
  taskId: string,
  sessionId: string,
  turnId: string | undefined,
  state: ChatRuntimeState,
  reason?: string,
): ChatEvent => ({
  type: 'chatRuntimeStateChanged',
  taskId,
  sessionId,
  turnId,
  timestamp: now(),
  state,
  reason,
});

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
