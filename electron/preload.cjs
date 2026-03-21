const { contextBridge, ipcRenderer } = require('electron');

const CHAT_CHANNELS = {
  startTask: 'chat:startTask',
  sendMessage: 'chat:sendMessage',
  abortTask: 'chat:abortTask',
  resumeTask: 'chat:resumeTask',
  selectDirectory: 'chat:selectDirectory',
  subscribeEvent: 'chat:event',
};

contextBridge.exposeInMainWorld('nami', {
  platform: process.platform,
  homeDir: process.env.HOME || '',
  chat: {
    startTask: (input) => ipcRenderer.invoke(CHAT_CHANNELS.startTask, input),
    sendMessage: (input) => ipcRenderer.invoke(CHAT_CHANNELS.sendMessage, input),
    abortTask: (input) => ipcRenderer.invoke(CHAT_CHANNELS.abortTask, input),
    resumeTask: (input) => ipcRenderer.invoke(CHAT_CHANNELS.resumeTask, input),
    selectDirectory: (input) => ipcRenderer.invoke(CHAT_CHANNELS.selectDirectory, input),
    subscribeEvents: (listener) => {
      const wrapped = (_event, payload) => listener(payload);
      ipcRenderer.on(CHAT_CHANNELS.subscribeEvent, wrapped);
      return () => ipcRenderer.off(CHAT_CHANNELS.subscribeEvent, wrapped);
    },
  },
});
