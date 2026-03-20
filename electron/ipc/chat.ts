import { BrowserWindow, dialog, ipcMain } from 'electron';
import {
  CHAT_CHANNELS,
  type AbortTaskInput,
  type CreateSessionInput,
  type RespondToApprovalInput,
  type ResumeSessionInput,
  type SelectDirectoryInput,
  type SendMessageInput,
  type SendMessageResult,
} from '../../core/chat.js';
import { ClineSessionService } from '../service/ClineSessionService.js';
import {
  createApprovalEvent,
  createApprovalResolvedEvent,
  createErrorEvent,
  createMessageEvent,
  createSessionEvent,
  createStatusEvent,
  createWorkspaceDiffEvent,
  normalizeSessionUpdate,
  toSessionSummary,
} from './chatEvents.js';

export const registerChatIpc = (window: BrowserWindow, userDataPath: string): ClineSessionService => {
  const service = new ClineSessionService(userDataPath);
  void service.initialize().catch((error) => {
    window.webContents.send(CHAT_CHANNELS.subscribeEvent, createErrorEvent(error instanceof Error ? error.message : 'Failed to initialize agent'));
  });

  service.subscribe((event) => {
    if (event.type === 'raw-update') {
      const normalized = normalizeSessionUpdate(event.sessionId, event.update);
      for (const item of normalized) {
        window.webContents.send(CHAT_CHANNELS.subscribeEvent, item);
      }
      return;
    }

    if (event.type === 'approval-request') {
      const approval = createApprovalEvent(event.sessionId, event.approvalId, event.request);
      window.webContents.send(CHAT_CHANNELS.subscribeEvent, approval);
      return;
    }

    if (event.type === 'approval-resolved') {
      const approval = createApprovalResolvedEvent(event.sessionId, event.approvalId, event.decision);
      window.webContents.send(CHAT_CHANNELS.subscribeEvent, approval);
      return;
    }

    if (event.type === 'session-state') {
      const sessionEvent = createSessionEvent(event.session);
      window.webContents.send(CHAT_CHANNELS.subscribeEvent, sessionEvent);
      return;
    }

    if (event.type === 'prompt-finished') {
      const status = createStatusEvent(
        event.sessionId,
        event.stopReason === 'cancelled' ? 'cancelled' : 'completed',
        'Turn finished',
        event.stopReason,
      );
      window.webContents.send(CHAT_CHANNELS.subscribeEvent, status);
      return;
    }

    if (event.type === 'workspace-diff') {
      const diff = createWorkspaceDiffEvent(event.sessionId, event.snapshot);
      if (!diff) {
        return;
      }
      window.webContents.send(CHAT_CHANNELS.subscribeEvent, diff);
      return;
    }

    const errorEvent = createErrorEvent(event.message, event.sessionId);
    window.webContents.send(CHAT_CHANNELS.subscribeEvent, errorEvent);
  });

  ipcMain.handle(CHAT_CHANNELS.createSession, async (_, input: CreateSessionInput) => {
    const session = await service.createSession({ cwd: input.cwd ?? process.cwd() });
    return toSessionSummary(session);
  });
  ipcMain.handle(CHAT_CHANNELS.resumeSession, async (_, input: ResumeSessionInput) => toSessionSummary(await service.resumeSession(input.sessionId)));
  ipcMain.handle(CHAT_CHANNELS.sendMessage, async (_, input: SendMessageInput): Promise<SendMessageResult> => {
    const session = await service.sendMessage(input);
    const userMessageEvent = createMessageEvent(session.sessionId, 'user', input.text);
    window.webContents.send(CHAT_CHANNELS.subscribeEvent, userMessageEvent);
    return { session: toSessionSummary(session) };
  });
  ipcMain.handle(CHAT_CHANNELS.abortTask, async (_, input: AbortTaskInput) => {
    await service.abortTask(input.sessionId);
  });
  ipcMain.handle(CHAT_CHANNELS.respondToApproval, async (_, input: RespondToApprovalInput) => {
    service.respondToApproval(input);
  });
  ipcMain.handle(CHAT_CHANNELS.listSessions, async () => (await service.listSessions()).map(toSessionSummary));
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
