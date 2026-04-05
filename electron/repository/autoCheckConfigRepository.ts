import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AutoCheckConfig } from '../../core/task.js';

const DEFAULT_AUTO_CHECK_CONFIG: AutoCheckConfig = {
  enabled: false,
  command: '',
};

const NAMI_DIRECTORY = '.nami';
const AUTO_CHECK_CONFIG_FILE = 'auto-check-config.json';

export class AutoCheckConfigRepository {
  constructor(_userDataPath: string) {}

  async get(cwd: string): Promise<AutoCheckConfig> {
    const filePath = this.resolveFilePath(cwd);
    try {
      const content = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as Partial<AutoCheckConfig>;
      return {
        enabled: parsed.enabled === true,
        command: typeof parsed.command === 'string' ? parsed.command : '',
      };
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return DEFAULT_AUTO_CHECK_CONFIG;
      }

      console.error('[auto-check-config] Failed to read config', {
        cwd,
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return DEFAULT_AUTO_CHECK_CONFIG;
    }
  }

  async save(cwd: string, config: AutoCheckConfig): Promise<void> {
    const filePath = this.resolveFilePath(cwd);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');
  }

  private resolveFilePath(cwd: string): string {
    return path.join(cwd, NAMI_DIRECTORY, AUTO_CHECK_CONFIG_FILE);
  }

  private isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
    return error !== null
      && typeof error === 'object'
      && 'code' in error
      && (error as NodeJS.ErrnoException).code === 'ENOENT';
  }
}