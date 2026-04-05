import { spawn } from 'node:child_process';
import type { AutoCheckConfig, AutoCheckResult, AutoCheckStep, AutoCheckStepResult } from '../../core/task.js';
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

const resolveConfiguredSteps = (config: AutoCheckConfig): AutoCheckStep[] => config.steps
  .map((step, index) => {
    const command = step.command.trim();
    if (!command) {
      return null;
    }

    return {
      id: step.id?.trim() || `step-${index + 1}`,
      name: step.name?.trim() || `Step ${index + 1}`,
      command,
    };
  })
  .filter((step): step is AutoCheckStep => step !== null);

const createDisabledResult = (): AutoCheckResult => ({
  success: false,
  exitCode: -1,
  stdout: '',
  stderr: '自動チェックが未設定、または無効です。',
  command: EMPTY_RESULT_COMMAND,
  ranAt: new Date().toISOString(),
  steps: [],
});

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
    const steps = resolveConfiguredSteps(resolvedConfig);
    if (!resolvedConfig.enabled || steps.length === 0) {
      return createDisabledResult();
    }

    const results: AutoCheckStepResult[] = [];
    for (const step of steps) {
      const stepResult = await this.runStep(cwd, step);
      results.push(stepResult);
      if (!stepResult.success) {
        return {
          success: false,
          exitCode: stepResult.exitCode,
          stdout: stepResult.stdout,
          stderr: stepResult.stderr,
          command: stepResult.command,
          ranAt: stepResult.ranAt,
          steps: results,
          failedStep: stepResult,
        };
      }
    }

    const lastStep = results.at(-1);
    return {
      success: true,
      exitCode: lastStep?.exitCode ?? 0,
      stdout: results.map((result) => result.stdout).filter(Boolean).join('\n'),
      stderr: results.map((result) => result.stderr).filter(Boolean).join('\n'),
      command: results.map((result) => result.command).join(' && '),
      ranAt: lastStep?.ranAt ?? new Date().toISOString(),
      steps: results,
    };
  }

  private runStep(cwd: string, step: AutoCheckStep): Promise<AutoCheckStepResult> {
    return new Promise<AutoCheckStepResult>((resolve, reject) => {
      const child = spawn(step.command, { cwd, shell: true, env: buildAutoCheckEnv(process.env) });
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
          stepId: step.id,
          name: step.name,
          success: code === 0,
          exitCode: code ?? -1,
          stdout,
          stderr,
          command: step.command,
          ranAt: new Date().toISOString(),
        });
      });
    });
  }
}