import type { GetWindowBootstrapStateResult } from '../../share/app';

const getAppApi = () => {
  if (!window.nami?.app) {
    throw new Error('Electron preload bridge is unavailable.');
  }

  return window.nami.app;
};

export const appRepository = {
  openWindow: (): Promise<void> => getAppApi().openWindow(),
  getWindowBootstrapState: (): Promise<GetWindowBootstrapStateResult> =>
    getAppApi().getWindowBootstrapState(),
};
