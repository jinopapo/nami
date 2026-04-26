import { appRepository } from '../repository/appRepository';

// eslint-disable-next-line no-grouped-exports/no-exported-function-object -- Existing service object; clean up separately.
export const windowService = {
  openWindow: (): Promise<void> => appRepository.openWindow(),
  getWindowBootstrapState: () => appRepository.getWindowBootstrapState(),
};
