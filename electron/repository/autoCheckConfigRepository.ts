/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_repository'. Dependency is of type 'share' */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AutoCheckConfig, AutoCheckStep } from '../../share/task.js';

const DEFAULT_AUTO_CHECK_CONFIG: AutoCheckConfig = {
  enabled: false,
  steps: [],
};

const NAMI_DIRECTORY = '.nami';
const AUTO_CHECK_CONFIG_FILE = 'auto-check-config.json';

const sanitizeStep = (
  step: Partial<AutoCheckStep>,
  index: number,
): AutoCheckStep | null => {
  const command = typeof step.command === 'string' ? step.command.trim() : '';
  if (!command) {
    return null;
  }

  const id =
    typeof step.id === 'string' && step.id.trim()
      ? step.id
      : `step-${index + 1}`;
  const name =
    typeof step.name === 'string' && step.name.trim()
      ? step.name
      : `Step ${index + 1}`;
  return { id, name, command };
};

const normalizeConfig = (parsed: unknown): AutoCheckConfig => {
  if (!parsed || typeof parsed !== 'object') {
    return DEFAULT_AUTO_CHECK_CONFIG;
  }

  const candidate = parsed as Partial<AutoCheckConfig> & { steps?: unknown };
  const steps = Array.isArray(candidate.steps)
    ? candidate.steps
        .map((step, index) =>
          sanitizeStep((step ?? {}) as Partial<AutoCheckStep>, index),
        )
        .filter((step): step is AutoCheckStep => step !== null)
    : [];

  return {
    enabled: candidate.enabled === true,
    steps,
  };
};

export class AutoCheckConfigRepository {
  constructor(_userDataPath: string) {}

  async get(cwd: string): Promise<AutoCheckConfig> {
    const filePath = this.resolveFilePath(cwd);
    try {
      const content = await readFile(filePath, 'utf-8');
      return normalizeConfig(JSON.parse(content) as unknown);
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
    return (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    );
  }
}
