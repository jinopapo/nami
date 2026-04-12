import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerAppIpc } from './ipc/app.js';
import { bindChatEvents, registerChatIpc } from './ipc/chat.js';
import { ClineSessionOrchestrator } from './ipc/clineSessionOrchestrator.js';
import { bindTaskEvents, registerTaskIpc } from './ipc/task.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const defaultDevServerUrl = 'http://127.0.0.1:5173';
const getDevServerUrl = () =>
  process.env.VITE_DEV_SERVER_URL ?? defaultDevServerUrl;

type WindowContext = {
  window: BrowserWindow;
  orchestrator: ClineSessionOrchestrator;
  restoreLastWorkspace: boolean;
};

const windowContexts = new Map<number, WindowContext>();

const registerWindowContext = (context: WindowContext): void => {
  windowContexts.set(context.window.webContents.id, context);
};

const unregisterWindowContext = (webContentsId: number): void => {
  windowContexts.delete(webContentsId);
};

const resolveWindowContext = (
  webContentsId: number,
): WindowContext | undefined => windowContexts.get(webContentsId);

function createWindow(options: { restoreLastWorkspace: boolean }) {
  const mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'electron/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const orchestrator = new ClineSessionOrchestrator(app.getPath('userData'));
  registerWindowContext({
    window: mainWindow,
    orchestrator,
    restoreLastWorkspace: options.restoreLastWorkspace,
  });

  const webContentsId = mainWindow.webContents.id;
  const unsubscribeChat = bindChatEvents(mainWindow, orchestrator);
  const unsubscribeTask = bindTaskEvents(mainWindow, orchestrator);
  mainWindow.on('closed', () => {
    unsubscribeChat();
    unsubscribeTask();
    unregisterWindowContext(webContentsId);
  });

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, code, description, url) => {
      console.error('did-fail-load', {
        code,
        description,
        url,
        expectedDevUrl: isDev ? getDevServerUrl() : undefined,
      });
    },
  );
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('render-process-gone', details);
  });
  mainWindow.webContents.on(
    'console-message',
    (_event, level, message, line, sourceId) => {
      console.log('renderer-console', { level, message, line, sourceId });
    },
  );

  if (isDev) {
    const devServerUrl = getDevServerUrl();
    console.log('Loading renderer from dev server', { devServerUrl });
    void mainWindow.loadURL(devServerUrl).catch((error) => {
      console.error('Failed to load dev server URL', {
        devServerUrl,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    mainWindow.webContents.openDevTools();
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(() => {
  registerChatIpc((sender) => resolveWindowContext(sender.id));
  registerTaskIpc(app.getPath('userData'), (sender) =>
    resolveWindowContext(sender.id),
  );
  registerAppIpc({
    openWindow: () => {
      createWindow({ restoreLastWorkspace: false });
    },
    resolveContext: (sender) => resolveWindowContext(sender.id),
  });

  createWindow({ restoreLastWorkspace: true });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow({ restoreLastWorkspace: true });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
