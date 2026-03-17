import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('nami', {
  platform: process.platform,
});