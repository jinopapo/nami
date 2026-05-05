import { spawn } from 'node:child_process';
import type {
  AutoCheckConfig,
  AutoCheckResult,
} from '../entity/autoCheckConfig.js';
import { AutoCheckConfigRepository } from '../repository/autoCheckConfigRepository.js';

type AutoCheckStep = AutoCheckConfig['steps'][number];
type AutoCheckStepResult = AutoCheckResult['steps'][number];
type AutoCheckProgressListener = {
  onStepStarted(input: { autoCheckRunId: string; step: AutoCheckStep }): void;
  onStepFinished(input: {
    autoCheckRunId: string;
    result: AutoCheckStepResult;
  }): void;
};

const EMPTY_RESULT_COMMAND = '';
const DEFAULT_LOGIN_SHELL =
  process.platform === 'darwin' ? '/bin/zsh' : '/bin/sh';

const combineOutput = (stdout: string, stderr: string): string =>
  [stdout, stderr].filter((value) => value.length > 0).join('\n');

export const resolveAutoCheckShell = (baseEnv: NodeJS.ProcessEnv): string =>
  baseEnv.SHELL?.trim() || DEFAULT_LOGIN_SHELL;

export const buildAutoCheckShellArgs = (command: string): string[] => [
  '-l',
  '-c',
  command,
];

const resolveConfiguredSteps = (config: AutoCheckConfig): AutoCheckStep[] =>
  config.steps
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
  output: '自動チェックが未設定、または無効です。',
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
    return this.runWithProgress(cwd, config);
  }

  async runWithProgress(
    cwd: string,
    config?: AutoCheckConfig,
    onProgress?: AutoCheckProgressListener,
    autoCheckRunId?: string,
  ): Promise<AutoCheckResult> {
    const resolvedConfig = config ?? (await this.repository.get(cwd));
    const steps = resolveConfiguredSteps(resolvedConfig);
    if (!resolvedConfig.enabled || steps.length === 0) {
      return createDisabledResult();
    }

    const results: AutoCheckStepResult[] = [];
    for (const step of steps) {
      onProgress?.onStepStarted({
        autoCheckRunId: autoCheckRunId ?? 'unknown',
        step,
      });
      const stepResult = await this.runStep(cwd, step);
      onProgress?.onStepFinished({
        autoCheckRunId: autoCheckRunId ?? 'unknown',
        result: stepResult,
      });
      results.push(stepResult);
      if (!stepResult.success) {
        return {
          success: false,
          exitCode: stepResult.exitCode,
          output: stepResult.output,
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
      output: results
        .map((result) => result.output)
        .filter(Boolean)
        .join('\n'),
      command: results.map((result) => result.command).join(' && '),
      ranAt: lastStep?.ranAt ?? new Date().toISOString(),
      steps: results,
    };
  }

  private runStep(
    cwd: string,
    step: AutoCheckStep,
  ): Promise<AutoCheckStepResult> {
    return new Promise<AutoCheckStepResult>((resolve, reject) => {
      const shell = resolveAutoCheckShell(process.env);
      const child = spawn(shell, buildAutoCheckShellArgs(step.command), {
        cwd,
        env: process.env,
      });
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
          output: combineOutput(stdout, stderr),
          command: step.command,
          ranAt: new Date().toISOString(),
        });
      });
    });
  }
}
