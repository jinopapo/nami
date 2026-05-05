import type { AutoApprovalConfig } from '../entity/autoApprovalConfig.js';
import { AutoApprovalConfigRepository } from '../repository/autoApprovalConfigRepository.js';

export class WorkspaceAutoApprovalService {
  private readonly repository: AutoApprovalConfigRepository;

  constructor(userDataPath: string) {
    this.repository = new AutoApprovalConfigRepository(userDataPath);
  }

  getConfig(cwd: string): Promise<AutoApprovalConfig> {
    return this.repository.get(cwd);
  }

  saveConfig(cwd: string, config: AutoApprovalConfig): Promise<void> {
    return this.repository.save(cwd, config);
  }
}
