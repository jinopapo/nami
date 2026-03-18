const { contextBridge, ipcRenderer } = require('electron');

const CHAT_CHANNELS = {
  createSession: 'chat:createSession',
  resumeSession: 'chat:resumeSession',
  sendMessage: 'chat:sendMessage',
  abortTask: 'chat:abortTask',
  respondToApproval: 'chat:respondToApproval',
  listSessions: 'chat:listSessions',
  selectDirectory: 'chat:selectDirectory',
  subscribeEvent: 'chat:event',
};

contextBridge.exposeInMainWorld('nami', {
  platform: process.platform,
  chat: {
    createSession: (input) => ipcRenderer.invoke(CHAT_CHANNELS.createSession, input),
    resumeSession: (input) => ipcRenderer.invoke(CHAT_CHANNELS.resumeSession, input),
    sendMessage: (input) => ipcRenderer.invoke(CHAT_CHANNELS.sendMessage, input),
    abortTask: (input) => ipcRenderer.invoke(CHAT_CHANNELS.abortTask, input),
    respondToApproval: (input) => ipcRenderer.invoke(CHAT_CHANNELS.respondToApproval, input),
    listSessions: () => ipcRenderer.invoke(CHAT_CHANNELS.listSessions),
    selectDirectory: (input) => ipcRenderer.invoke(CHAT_CHANNELS.selectDirectory, input),
    subscribeEvents: (listener) => {
      const wrapped = (_event, payload) => listener(payload);
      ipcRenderer.on(CHAT_CHANNELS.subscribeEvent, wrapped);
      return () => ipcRenderer.off(CHAT_CHANNELS.subscribeEvent, wrapped);
    },
  },
});
