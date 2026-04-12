import { appRepository } from '../repository/appRepository';

export const windowService = {
  openWindow: (): Promise<void> => appRepository.openWindow(),
  getWindowBootstrapState: () => appRepository.getWindowBootstrapState(),
};
