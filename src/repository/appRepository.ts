import type { GetWindowBootstrapStateResult } from '../../share/app';

const getAppApi = () => {
  if (!window.nami?.app) {
    throw new Error('Electron preload bridge is unavailable.');
  }

  return window.nami.app;
};

// eslint-disable-next-line no-grouped-exports/no-exported-function-object -- Existing service object; clean up separately.
export const appRepository = {
  openWindow: (): Promise<void> => getAppApi().openWindow(),
  getWindowBootstrapState: (): Promise<GetWindowBootstrapStateResult> =>
    getAppApi().getWindowBootstrapState(),
};
