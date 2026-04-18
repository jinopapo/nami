import { spawn } from 'node:child_process';
import type { TaskWorkspaceMergeResult } from '../entity/taskWorkspace.js';
import {
  buildResolveWorkTrunkShellArgs,
  classifyMergeFailureReason,
  combineCommandOutput,
  extractWorkTrunkMergeMessage,
  resolveWorkTrunkShell,
  toCommandResult,
} from '../mapper/worktreeCommandMapper.js';
import type { CommandResult } from '../resource/commandResult.js';

class WorkTrunkCommandNotFoundError extends Error {
  readonly code = 'ENOENT';

  constructor(message: string) {
    super(message);
    this.name = 'WorkTrunkCommandNotFoundError';
  }
}

export { buildResolveWorkTrunkShellArgs, resolveWorkTrunkShell };

type MergeWorktreeResult = TaskWorkspaceMergeResult;

export class WorkTrunkRepository {
  private resolvedWorkTrunkPath?: string;
  private resolvingWorkTrunkPath?: Promise<string>;

  async createWorktree(input: {
    projectWorkspacePath: string;
    taskBranchName: string;
  }): Promise<void> {
    const result = await this.runWorkTrunkCommand(
      ['switch', '--create', input.taskBranchName],
      input.projectWorkspacePath,
    );
    if (result.exitCode !== 0) {
      throw new Error(combineCommandOutput(result.stdout, result.stderr));
    }
  }

  async copyIgnoredFiles(input: { taskWorkspacePath: string }): Promise<void> {
    const result = await this.runWorkTrunkCommand(
      ['step', 'copy-ignored'],
      input.taskWorkspacePath,
    );
    if (result.exitCode !== 0) {
      throw new Error(combineCommandOutput(result.stdout, result.stderr));
    }
  }

  async mergeCurrentWorktree(input: {
    taskWorkspacePath: string;
    baseBranchName: string;
  }): Promise<MergeWorktreeResult> {
    const result = await this.runWorkTrunkCommand(
      ['merge', input.baseBranchName, '--format', 'json', '-y'],
      input.taskWorkspacePath,
    );
    const output = combineCommandOutput(result.stdout, result.stderr);
    if (result.exitCode === 0) {
      return {
        workspaceStatus: 'merged',
        mergeStatus: 'succeeded',
        mergeMessage: extractWorkTrunkMergeMessage(result.stdout) ?? output,
      };
    }
    return {
      workspaceStatus: 'merge_failed',
      mergeStatus: 'failed',
      mergeFailureReason: classifyMergeFailureReason(result, result.errorCode),
      mergeMessage: extractWorkTrunkMergeMessage(result.stdout) ?? output,
    };
  }

  async pruneMergedWorktrees(projectWorkspacePath: string): Promise<void> {
    const result = await this.runWorkTrunkCommand(
      ['step', 'prune'],
      projectWorkspacePath,
    );
    if (result.exitCode !== 0) {
      throw new Error(combineCommandOutput(result.stdout, result.stderr));
    }
  }

  protected async runWorkTrunkCommand(
    args: string[],
    cwd: string,
  ): Promise<CommandResult> {
    let workTrunkPath: string;
    try {
      workTrunkPath = await this.getWorkTrunkPath();
    } catch (error) {
      return toCommandResult(error as NodeJS.ErrnoException);
    }
    return this.runCommand(workTrunkPath, args, { cwd }).catch(
      (error: NodeJS.ErrnoException) => toCommandResult(error),
    );
  }

  protected runCommand(
    command: string,
    args: string[],
    options: { cwd: string },
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
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
      child.on('error', (error) => reject(error));
      child.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code ?? -1 });
      });
    });
  }

  private async getWorkTrunkPath(): Promise<string> {
    if (this.resolvedWorkTrunkPath) {
      return this.resolvedWorkTrunkPath;
    }
    if (!this.resolvingWorkTrunkPath) {
      this.resolvingWorkTrunkPath = this.resolveWorkTrunkPath()
        .then((resolvedPath) => {
          this.resolvedWorkTrunkPath = resolvedPath;
          return resolvedPath;
        })
        .finally(() => {
          this.resolvingWorkTrunkPath = undefined;
        });
    }
    return this.resolvingWorkTrunkPath;
  }

  private async resolveWorkTrunkPath(): Promise<string> {
    const shell = resolveWorkTrunkShell(process.env);
    const result = await this.runCommand(
      shell,
      buildResolveWorkTrunkShellArgs(),
      { cwd: process.cwd() },
    ).catch((error: NodeJS.ErrnoException) => toCommandResult(error));
    const resolvedPath = result.stdout
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);
    if (result.exitCode !== 0 || !resolvedPath) {
      throw new WorkTrunkCommandNotFoundError(
        combineCommandOutput(result.stdout, result.stderr) ||
          'Failed to resolve wt from the login shell.',
      );
    }
    return resolvedPath;
  }
}
