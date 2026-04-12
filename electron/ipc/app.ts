import { ipcMain, type WebContents } from 'electron';
import type { GetWindowBootstrapStateResult } from '../../share/app.js';

const APP_CHANNELS = {
  openWindow: 'app:openWindow',
  getWindowBootstrapState: 'app:getWindowBootstrapState',
} as const;

type AppWindowContext = {
  restoreLastWorkspace: boolean;
};

type RegisterAppIpcInput = {
  openWindow: () => void;
  resolveContext: (sender: WebContents) => AppWindowContext | undefined;
};

export const registerAppIpc = ({
  openWindow,
  resolveContext,
}: RegisterAppIpcInput): void => {
  ipcMain.handle(APP_CHANNELS.openWindow, async () => {
    openWindow();
  });

  ipcMain.handle(
    APP_CHANNELS.getWindowBootstrapState,
    async (event): Promise<GetWindowBootstrapStateResult> => ({
      restoreLastWorkspace:
        resolveContext(event.sender)?.restoreLastWorkspace ?? false,
    }),
  );
};
