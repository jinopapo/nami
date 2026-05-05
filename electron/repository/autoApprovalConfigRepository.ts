import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AutoApprovalConfig } from '../entity/autoApprovalConfig.js';

const DEFAULT_AUTO_APPROVAL_CONFIG: AutoApprovalConfig = {
  enabled: false,
};

const NAMI_DIRECTORY = '.nami';
const AUTO_APPROVAL_CONFIG_FILE = 'auto-approval-config.json';

const normalizeConfig = (parsed: unknown): AutoApprovalConfig => {
  if (!parsed || typeof parsed !== 'object') {
    return DEFAULT_AUTO_APPROVAL_CONFIG;
  }

  const candidate = parsed as Partial<AutoApprovalConfig>;
  return {
    enabled: candidate.enabled === true,
  };
};

export class AutoApprovalConfigRepository {
  constructor(_userDataPath: string) {}

  async get(cwd: string): Promise<AutoApprovalConfig> {
    const filePath = this.resolveFilePath(cwd);
    try {
      const content = await readFile(filePath, 'utf-8');
      return normalizeConfig(JSON.parse(content) as unknown);
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return DEFAULT_AUTO_APPROVAL_CONFIG;
      }

      console.error('[auto-approval-config] Failed to read config', {
        cwd,
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return DEFAULT_AUTO_APPROVAL_CONFIG;
    }
  }

  async save(cwd: string, config: AutoApprovalConfig): Promise<void> {
    const filePath = this.resolveFilePath(cwd);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
  }

  private resolveFilePath(cwd: string): string {
    return path.join(cwd, NAMI_DIRECTORY, AUTO_APPROVAL_CONFIG_FILE);
  }

  private isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
    return (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    );
  }
}
