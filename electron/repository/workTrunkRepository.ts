/* eslint-disable max-lines */
import { spawn } from 'node:child_process';
import type {
  ReviewDiffFile,
  TaskMergeFailureReason,
} from '../../share/task.js';
import { mapGitDiffToReviewDiffFiles } from '../mapper/reviewDiffMapper.js';
import type { TaskWorkspaceMergeResult } from '../entity/taskWorkspace.js';

// ts-prune-ignore-next
export type CreateWorktreeResult = {
  taskWorkspacePath: string;
  taskBranchName: string;
  baseBranchName: string;
};

type MergeWorktreeResult = TaskWorkspaceMergeResult;
type CommitChangesResult = { commitHash: string; output: string };
type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  errorCode?: string;
};

const DEFAULT_LOGIN_SHELL =
  process.platform === 'darwin' ? '/bin/zsh' : '/bin/sh';

export const resolveWorkTrunkShell = (baseEnv: NodeJS.ProcessEnv): string =>
  baseEnv.SHELL?.trim() || DEFAULT_LOGIN_SHELL;

export const buildResolveWorkTrunkShellArgs = (): string[] => [
  '-l',
  '-c',
  'command -v wt',
];

const combineOutput = (stdout: string, stderr: string): string =>
  [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');

const toCommandResult = (error: NodeJS.ErrnoException): CommandResult => ({
  stdout: '',
  stderr: error.message,
  exitCode: -1,
  errorCode: error.code,
});

class WorkTrunkCommandNotFoundError extends Error {
  readonly code = 'ENOENT';

  constructor(message: string) {
    super(message);
    this.name = 'WorkTrunkCommandNotFoundError';
  }
}

const classifyFailureReason = (
  result: CommandResult,
  errorCode?: string,
): TaskMergeFailureReason => {
  const output = combineOutput(result.stdout, result.stderr);
  if (
    errorCode === 'ENOENT' ||
    /command not found|not found: wt/i.test(output)
  ) {
    return 'worktrunk_unavailable';
  }
  if (/not a git repository/i.test(output)) {
    return 'not_git_repository';
  }
  if (/conflict/i.test(output)) {
    return 'conflict';
  }
  if (/hook/i.test(output)) {
    return 'hook_failed';
  }
  if (result.exitCode !== 0) {
    return 'command_failed';
  }
  return 'unknown';
};

export class WorkTrunkRepository {
  private resolvedWorkTrunkPath?: string;
  private resolvingWorkTrunkPath?: Promise<string>;

  async getCurrentBranch(projectWorkspacePath: string): Promise<string> {
    const result = await this.runCommand('git', ['branch', '--show-current'], {
      cwd: projectWorkspacePath,
    });
    if (result.exitCode !== 0) {
      throw new Error(combineOutput(result.stdout, result.stderr));
    }
    return result.stdout.trim();
  }

  async createWorktree(input: {
    projectWorkspacePath: string;
    taskBranchName: string;
  }): Promise<CreateWorktreeResult> {
    const baseBranchName = await this.getCurrentBranch(
      input.projectWorkspacePath,
    );
    const createResult = await this.runWorkTrunkCommand(
      ['switch', '--create', input.taskBranchName],
      input.projectWorkspacePath,
    );
    if (createResult.exitCode !== 0) {
      throw new Error(combineOutput(createResult.stdout, createResult.stderr));
    }

    const listResult = await this.runCommand(
      'git',
      ['worktree', 'list', '--porcelain'],
      { cwd: input.projectWorkspacePath },
    );
    if (listResult.exitCode !== 0) {
      throw new Error(combineOutput(listResult.stdout, listResult.stderr));
    }

    const taskWorkspacePath = this.findWorktreePathForBranch(
      listResult.stdout,
      input.taskBranchName,
    );
    if (!taskWorkspacePath) {
      throw new Error(
        `Failed to resolve worktree path for ${input.taskBranchName}`,
      );
    }

    return {
      taskWorkspacePath,
      taskBranchName: input.taskBranchName,
      baseBranchName,
    };
  }

  async copyIgnoredFiles(input: { taskWorkspacePath: string }): Promise<void> {
    const result = await this.runWorkTrunkCommand(
      ['step', 'copy-ignored'],
      input.taskWorkspacePath,
    );
    if (result.exitCode !== 0) {
      throw new Error(combineOutput(result.stdout, result.stderr));
    }
  }

  async removeWorktree(input: {
    projectWorkspacePath: string;
    taskWorkspacePath: string;
    taskBranchName: string;
  }): Promise<void> {
    const removeResult = await this.runCommand(
      'git',
      ['worktree', 'remove', '--force', input.taskWorkspacePath],
      { cwd: input.projectWorkspacePath },
    );
    if (removeResult.exitCode !== 0) {
      throw new Error(combineOutput(removeResult.stdout, removeResult.stderr));
    }

    const deleteBranchResult = await this.runCommand(
      'git',
      ['branch', '-D', input.taskBranchName],
      { cwd: input.projectWorkspacePath },
    );
    if (deleteBranchResult.exitCode !== 0) {
      throw new Error(
        combineOutput(deleteBranchResult.stdout, deleteBranchResult.stderr),
      );
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
    const output = combineOutput(result.stdout, result.stderr);
    if (result.exitCode === 0) {
      return {
        workspaceStatus: 'merged',
        mergeStatus: 'succeeded',
        mergeMessage: this.extractMergeMessage(result.stdout) ?? output,
      };
    }
    return {
      workspaceStatus: 'merge_failed',
      mergeStatus: 'failed',
      mergeFailureReason: classifyFailureReason(result, result.errorCode),
      mergeMessage: this.extractMergeMessage(result.stdout) ?? output,
    };
  }

  async getReviewDiff(input: {
    taskWorkspacePath: string;
    baseBranchName: string;
  }): Promise<ReviewDiffFile[]> {
    const result = await this.runCommand(
      'git',
      [
        'diff',
        '--no-color',
        '--find-renames',
        '--unified=3',
        `${input.baseBranchName}...HEAD`,
      ],
      { cwd: input.taskWorkspacePath },
    );
    if (result.exitCode !== 0) {
      throw new Error(combineOutput(result.stdout, result.stderr));
    }
    return mapGitDiffToReviewDiffFiles(result.stdout);
  }

  async commitReview(input: {
    taskWorkspacePath: string;
    message: string;
  }): Promise<CommitChangesResult> {
    const addResult = await this.runCommand('git', ['add', '-A'], {
      cwd: input.taskWorkspacePath,
    });
    if (addResult.exitCode !== 0) {
      throw new Error(combineOutput(addResult.stdout, addResult.stderr));
    }

    const commitResult = await this.runCommand(
      'git',
      ['commit', '--message', input.message],
      { cwd: input.taskWorkspacePath },
    );
    if (commitResult.exitCode !== 0) {
      throw new Error(combineOutput(commitResult.stdout, commitResult.stderr));
    }

    const hashResult = await this.runCommand('git', ['rev-parse', 'HEAD'], {
      cwd: input.taskWorkspacePath,
    });
    if (hashResult.exitCode !== 0) {
      throw new Error(combineOutput(hashResult.stdout, hashResult.stderr));
    }

    return {
      commitHash: hashResult.stdout.trim(),
      output: combineOutput(commitResult.stdout, commitResult.stderr),
    };
  }

  async pruneMergedWorktrees(projectWorkspacePath: string): Promise<void> {
    const result = await this.runWorkTrunkCommand(
      ['step', 'prune'],
      projectWorkspacePath,
    );
    if (result.exitCode !== 0) {
      throw new Error(combineOutput(result.stdout, result.stderr));
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
        combineOutput(result.stdout, result.stderr) ||
          'Failed to resolve wt from the login shell.',
      );
    }
    return resolvedPath;
  }

  private findWorktreePathForBranch(
    porcelain: string,
    branchName: string,
  ): string | undefined {
    const blocks = porcelain.trim().split('\n\n');
    for (const block of blocks) {
      const lines = block.split('\n');
      const worktreeLine = lines.find((line) => line.startsWith('worktree '));
      const branchLine = lines.find((line) =>
        line.startsWith(`branch refs/heads/${branchName}`),
      );
      if (worktreeLine && branchLine) {
        return worktreeLine.replace('worktree ', '').trim();
      }
    }
    return undefined;
  }

  private extractMergeMessage(stdout: string): string | undefined {
    try {
      const parsed = JSON.parse(stdout) as { message?: string; error?: string };
      return parsed.message ?? parsed.error;
    } catch {
      return undefined;
    }
  }
}
