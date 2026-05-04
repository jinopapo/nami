import { spawn } from 'node:child_process';
import type { ReviewDiffFile } from '../entity/reviewDiff.js';
import { mapGitDiffToReviewDiffFiles } from '../mapper/reviewDiffMapper.js';
import {
  combineCommandOutput,
  resolveWorktreePathFromPorcelain,
} from '../mapper/worktreeCommandMapper.js';
import type { CommandResult } from '../resource/commandResult.js';
import { REVIEW_DIFF_BASE_ARGS } from '../resource/commandResult.js';

type CommitChangesResult = { commitHash: string; output: string };

export class GitRepository {
  async getCurrentBranch(projectWorkspacePath: string): Promise<string> {
    const result = await this.runCommand('git', ['branch', '--show-current'], {
      cwd: projectWorkspacePath,
    });
    if (result.exitCode !== 0) {
      throw new Error(combineCommandOutput(result.stdout, result.stderr));
    }
    return result.stdout.trim();
  }

  async getWorktreePath(
    projectWorkspacePath: string,
    branchName: string,
  ): Promise<string | undefined> {
    const result = await this.runCommand(
      'git',
      ['worktree', 'list', '--porcelain'],
      { cwd: projectWorkspacePath },
    );
    if (result.exitCode !== 0) {
      throw new Error(combineCommandOutput(result.stdout, result.stderr));
    }
    return resolveWorktreePathFromPorcelain(result.stdout, branchName);
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
      throw new Error(
        combineCommandOutput(removeResult.stdout, removeResult.stderr),
      );
    }

    const deleteBranchResult = await this.runCommand(
      'git',
      ['branch', '-D', input.taskBranchName],
      { cwd: input.projectWorkspacePath },
    );
    if (deleteBranchResult.exitCode !== 0) {
      throw new Error(
        combineCommandOutput(
          deleteBranchResult.stdout,
          deleteBranchResult.stderr,
        ),
      );
    }
  }

  async getReviewDiff(input: {
    taskWorkspacePath: string;
    baseBranchName: string;
  }): Promise<ReviewDiffFile[]> {
    const mergeBaseResult = await this.runCommand(
      'git',
      ['merge-base', input.baseBranchName, 'HEAD'],
      { cwd: input.taskWorkspacePath },
    );
    if (mergeBaseResult.exitCode !== 0) {
      throw new Error(
        combineCommandOutput(mergeBaseResult.stdout, mergeBaseResult.stderr),
      );
    }

    const mergeBase = mergeBaseResult.stdout.trim();
    if (!mergeBase) {
      throw new Error('Failed to resolve merge base for review diff.');
    }

    const trackedDiffResult = await this.runCommand(
      'git',
      ['diff', ...REVIEW_DIFF_BASE_ARGS, mergeBase],
      { cwd: input.taskWorkspacePath },
    );
    if (trackedDiffResult.exitCode !== 0) {
      throw new Error(
        combineCommandOutput(
          trackedDiffResult.stdout,
          trackedDiffResult.stderr,
        ),
      );
    }

    const untrackedDiffs = await this.getUntrackedDiffs(
      input.taskWorkspacePath,
    );
    const diffText = [trackedDiffResult.stdout, ...untrackedDiffs]
      .map((segment) => segment.trim())
      .filter(Boolean)
      .join('\n');

    return mapGitDiffToReviewDiffFiles(diffText);
  }

  async commitReview(input: {
    taskWorkspacePath: string;
    message: string;
  }): Promise<CommitChangesResult> {
    const addResult = await this.runCommand('git', ['add', '-A'], {
      cwd: input.taskWorkspacePath,
    });
    if (addResult.exitCode !== 0) {
      throw new Error(combineCommandOutput(addResult.stdout, addResult.stderr));
    }

    const commitResult = await this.runCommand(
      'git',
      ['commit', '--message', input.message],
      { cwd: input.taskWorkspacePath },
    );
    if (commitResult.exitCode !== 0) {
      throw new Error(
        combineCommandOutput(commitResult.stdout, commitResult.stderr),
      );
    }

    const hashResult = await this.runCommand('git', ['rev-parse', 'HEAD'], {
      cwd: input.taskWorkspacePath,
    });
    if (hashResult.exitCode !== 0) {
      throw new Error(
        combineCommandOutput(hashResult.stdout, hashResult.stderr),
      );
    }

    return {
      commitHash: hashResult.stdout.trim(),
      output: combineCommandOutput(commitResult.stdout, commitResult.stderr),
    };
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

  private async getUntrackedDiffs(
    taskWorkspacePath: string,
  ): Promise<string[]> {
    const untrackedFilesResult = await this.runCommand(
      'git',
      ['ls-files', '--others', '--exclude-standard'],
      { cwd: taskWorkspacePath },
    );
    if (untrackedFilesResult.exitCode !== 0) {
      throw new Error(
        combineCommandOutput(
          untrackedFilesResult.stdout,
          untrackedFilesResult.stderr,
        ),
      );
    }

    const untrackedFiles = untrackedFilesResult.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    return Promise.all(
      untrackedFiles.map(async (filePath) => {
        const untrackedDiffResult = await this.runCommand(
          'git',
          [
            'diff',
            ...REVIEW_DIFF_BASE_ARGS,
            '--no-index',
            '--',
            '/dev/null',
            filePath,
          ],
          { cwd: taskWorkspacePath },
        );
        if (
          untrackedDiffResult.exitCode !== 0 &&
          untrackedDiffResult.exitCode !== 1
        ) {
          throw new Error(
            combineCommandOutput(
              untrackedDiffResult.stdout,
              untrackedDiffResult.stderr,
            ),
          );
        }

        return untrackedDiffResult.stdout;
      }),
    );
  }
}
