import { WorkspacePreferenceRepository } from '../repository/workspacePreferenceRepository.js';

export class WorkspacePreferenceService {
  private readonly repository: WorkspacePreferenceRepository;

  constructor(userDataPath: string) {
    this.repository = new WorkspacePreferenceRepository(userDataPath);
  }

  getLastSelectedWorkspace(): Promise<string | undefined> {
    return this.repository.getLastSelectedWorkspace();
  }

  saveLastSelectedWorkspace(workspacePath: string): Promise<void> {
    return this.repository.saveLastSelectedWorkspace(workspacePath);
  }
}
