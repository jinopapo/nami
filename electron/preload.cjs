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
  getCurrentBranch: 'task:getCurrentBranch',
  getReviewDiff: 'task:getReviewDiff',
  commitReview: 'task:commitReview',
  getAutoCheckConfig: 'task:getAutoCheckConfig',
  saveAutoCheckConfig: 'task:saveAutoCheckConfig',
  runAutoCheck: 'task:runAutoCheck',
  subscribeEvent: 'task:event',
};

contextBridge.exposeInMainWorld('nami', {
  platform: process.platform,
  homeDir: process.env.HOME || '',
  chat: {
    sendMessage: (input) =>
      ipcRenderer.invoke(CHAT_CHANNELS.sendMessage, input),
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
    transitionLifecycle: (input) =>
      ipcRenderer.invoke(TASK_CHANNELS.transitionLifecycle, input),
    selectDirectory: (input) =>
      ipcRenderer.invoke(TASK_CHANNELS.selectDirectory, input),
    getLastSelectedWorkspace: () =>
      ipcRenderer.invoke(TASK_CHANNELS.getLastSelectedWorkspace),
    getCurrentBranch: (input) =>
      ipcRenderer.invoke(TASK_CHANNELS.getCurrentBranch, input),
    getReviewDiff: (input) =>
      ipcRenderer.invoke(TASK_CHANNELS.getReviewDiff, input),
    commitReview: (input) =>
      ipcRenderer.invoke(TASK_CHANNELS.commitReview, input),
    getAutoCheckConfig: (input) =>
      ipcRenderer.invoke(TASK_CHANNELS.getAutoCheckConfig, input),
    saveAutoCheckConfig: (input) =>
      ipcRenderer.invoke(TASK_CHANNELS.saveAutoCheckConfig, input),
    runAutoCheck: (input) =>
      ipcRenderer.invoke(TASK_CHANNELS.runAutoCheck, input),
    subscribeEvents: (listener) => {
      const wrapped = (_event, payload) => listener(payload);
      ipcRenderer.on(TASK_CHANNELS.subscribeEvent, wrapped);
      return () => ipcRenderer.off(TASK_CHANNELS.subscribeEvent, wrapped);
    },
  },
});
