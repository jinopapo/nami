import type { TaskMergeFailureReason } from '../../share/task.js';
import type { CommandResult } from '../resource/commandResult.js';
import {
  DEFAULT_LOGIN_SHELL,
  RESOLVE_WORKTRUNK_SHELL_ARGS,
} from '../resource/commandResult.js';

export const combineCommandOutput = (stdout: string, stderr: string): string =>
  [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');

export const toCommandResult = (
  error: NodeJS.ErrnoException,
): CommandResult => ({
  stdout: '',
  stderr: error.message,
  exitCode: -1,
  errorCode: error.code,
});

export const classifyMergeFailureReason = (
  result: CommandResult,
  errorCode?: string,
): TaskMergeFailureReason => {
  const output = combineCommandOutput(result.stdout, result.stderr);
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

export const resolveWorkTrunkShell = (baseEnv: NodeJS.ProcessEnv): string =>
  baseEnv.SHELL?.trim() || DEFAULT_LOGIN_SHELL;

export const buildResolveWorkTrunkShellArgs = (): string[] => [
  ...RESOLVE_WORKTRUNK_SHELL_ARGS,
];

export const resolveWorktreePathFromPorcelain = (
  porcelain: string,
  branchName: string,
): string | undefined => {
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
};

export const extractWorkTrunkMergeMessage = (
  stdout: string,
): string | undefined => {
  try {
    const parsed = JSON.parse(stdout) as { message?: string; error?: string };
    return parsed.message ?? parsed.error;
  } catch {
    return undefined;
  }
};
