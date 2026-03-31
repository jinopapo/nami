const { contextBridge, ipcRenderer } = require('electron');

const CHAT_CHANNELS = {
  sendMessage: 'chat:sendMessage',
  abortTask: 'chat:abortTask',
  resumeTask: 'chat:resumeTask',
  subscribeEvent: 'chat:event',
};

const TASK_CHANNELS = {
  create: 'task:create',
  transitionLifecycle: 'task:transitionLifecycle',
  selectDirectory: 'task:selectDirectory',
  getLastSelectedWorkspace: 'task:getLastSelectedWorkspace',
  subscribeEvent: 'task:event',
};

contextBridge.exposeInMainWorld('nami', {
  platform: process.platform,
  homeDir: process.env.HOME || '',
  chat: {
    sendMessage: (input) => ipcRenderer.invoke(CHAT_CHANNELS.sendMessage, input),
    abortTask: (input) => ipcRenderer.invoke(CHAT_CHANNELS.abortTask, input),
    resumeTask: (input) => ipcRenderer.invoke(CHAT_CHANNELS.resumeTask, input),
    subscribeEvents: (listener) => {
      const wrapped = (_event, payload) => listener(payload);
      ipcRenderer.on(CHAT_CHANNELS.subscribeEvent, wrapped);
      return () => ipcRenderer.off(CHAT_CHANNELS.subscribeEvent, wrapped);
    },
  },
  task: {
    create: (input) => ipcRenderer.invoke(TASK_CHANNELS.create, input),
    transitionLifecycle: (input) => ipcRenderer.invoke(TASK_CHANNELS.transitionLifecycle, input),
    selectDirectory: (input) => ipcRenderer.invoke(TASK_CHANNELS.selectDirectory, input),
    getLastSelectedWorkspace: () => ipcRenderer.invoke(TASK_CHANNELS.getLastSelectedWorkspace),
    subscribeEvents: (listener) => {
      const wrapped = (_event, payload) => listener(payload);
      ipcRenderer.on(TASK_CHANNELS.subscribeEvent, wrapped);
      return () => ipcRenderer.off(TASK_CHANNELS.subscribeEvent, wrapped);
    },
  },
});
