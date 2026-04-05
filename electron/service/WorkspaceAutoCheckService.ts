import { spawn } from 'node:child_process';
import type { AutoCheckConfig, AutoCheckResult } from '../../core/task.js';
import { AutoCheckConfigRepository } from '../repository/autoCheckConfigRepository.js';

const EMPTY_RESULT_COMMAND = '';
const PATH_SEPARATOR = ':';
const DEFAULT_PATH_SEGMENTS = [
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/local/sbin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
];

export const buildAutoCheckEnv = (baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const pathSegments = [
    ...(baseEnv.PATH?.split(PATH_SEPARATOR) ?? []),
    ...DEFAULT_PATH_SEGMENTS,
  ].filter((segment, index, array) => Boolean(segment) && array.indexOf(segment) === index);

  return {
    ...baseEnv,
    PATH: pathSegments.join(PATH_SEPARATOR),
  };
};

export class WorkspaceAutoCheckService {
  private readonly repository: AutoCheckConfigRepository;

  constructor(userDataPath: string) {
    this.repository = new AutoCheckConfigRepository(userDataPath);
  }

  getConfig(cwd: string): Promise<AutoCheckConfig> {
    return this.repository.get(cwd);
  }

  saveConfig(cwd: string, config: AutoCheckConfig): Promise<void> {
    return this.repository.save(cwd, config);
  }

  async run(cwd: string, config?: AutoCheckConfig): Promise<AutoCheckResult> {
    const resolvedConfig = config ?? await this.repository.get(cwd);
    const command = resolvedConfig.command.trim();
    if (!resolvedConfig.enabled || !command) {
      return {
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: '自動チェックが未設定、または無効です。',
        command: command || EMPTY_RESULT_COMMAND,
        ranAt: new Date().toISOString(),
      };
    }

    return new Promise<AutoCheckResult>((resolve, reject) => {
      const child = spawn(command, { cwd, shell: true, env: buildAutoCheckEnv(process.env) });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', (error) => {
        reject(error);
      });
      child.on('close', (code) => {
        resolve({
          success: code === 0,
          exitCode: code ?? -1,
          stdout,
          stderr,
          command,
          ranAt: new Date().toISOString(),
        });
      });
    });
  }
}