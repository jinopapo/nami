import { describe, expect, it } from 'vitest';
import {
  buildResolveWorkTrunkShellArgs,
  resolveWorkTrunkShell,
  WorkTrunkRepository,
} from './workTrunkRepository.js';

type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  errorCode?: string;
};

class TestWorkTrunkRepository extends WorkTrunkRepository {
  readonly calls: Array<{ command: string; args: string[]; cwd: string }> = [];

  constructor(private readonly responses: Array<CommandResult>) {
    super();
  }

  protected override runCommand(
    command: string,
    args: string[],
    options: { cwd: string },
  ): Promise<CommandResult> {
    this.calls.push({ command, args, cwd: options.cwd });
    const response = this.responses.shift();
    if (!response) {
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    }
    return Promise.resolve(response);
  }
}

describe('resolveWorkTrunkShell', () => {
  it('uses SHELL from the environment when available', () => {
    expect(resolveWorkTrunkShell({ SHELL: '/opt/homebrew/bin/fish' })).toBe(
      '/opt/homebrew/bin/fish',
    );
  });

  it('falls back to the platform default when SHELL is missing', () => {
    expect(resolveWorkTrunkShell({})).toBe(
      process.platform === 'darwin' ? '/bin/zsh' : '/bin/sh',
    );
  });
});

describe('buildResolveWorkTrunkShellArgs', () => {
  it('builds login shell args that resolve wt', () => {
    expect(buildResolveWorkTrunkShellArgs()).toEqual(['-l', '-c', 'command -v wt']);
  });
});

describe('WorkTrunkRepository', () => {
  it('resolves wt via the login shell and reuses the resolved path', async () => {
    const repository = new TestWorkTrunkRepository([
      { stdout: 'main\n', stderr: '', exitCode: 0 },
      { stdout: '/opt/homebrew/bin/wt\n', stderr: '', exitCode: 0 },
      { stdout: '', stderr: '', exitCode: 0 },
      {
        stdout:
          'worktree /repo.task.task-123\nbranch refs/heads/task/task-123\n',
        stderr: '',
        exitCode: 0,
      },
      { stdout: '', stderr: '', exitCode: 0 },
    ]);

    await repository.createWorktree({
      projectWorkspacePath: '/repo',
      taskBranchName: 'task/task-123',
    });
    await repository.copyIgnoredFiles({
      taskWorkspacePath: '/repo.task.task-123',
    });

    expect(repository.calls).toEqual([
      {
        command: 'git',
        args: ['branch', '--show-current'],
        cwd: '/repo',
      },
      {
        command: resolveWorkTrunkShell(process.env),
        args: ['-l', '-c', 'command -v wt'],
        cwd: process.cwd(),
      },
      {
        command: '/opt/homebrew/bin/wt',
        args: ['switch', '--create', 'task/task-123'],
        cwd: '/repo',
      },
      {
        command: 'git',
        args: ['worktree', 'list', '--porcelain'],
        cwd: '/repo',
      },
      {
        command: '/opt/homebrew/bin/wt',
        args: ['step', 'copy-ignored'],
        cwd: '/repo.task.task-123',
      },
    ]);
  });

  it('throws a descriptive error when wt cannot be resolved from the login shell', async () => {
    const repository = new TestWorkTrunkRepository([
      { stdout: 'main\n', stderr: '', exitCode: 0 },
      { stdout: '', stderr: 'wt: command not found', exitCode: 127 },
    ]);

    await expect(
      repository.createWorktree({
        projectWorkspacePath: '/repo',
        taskBranchName: 'task/task-123',
      }),
    ).rejects.toThrow('wt: command not found');
  });

  it('maps unresolved wt to worktrunk_unavailable during merge', async () => {
    const repository = new TestWorkTrunkRepository([
      { stdout: '', stderr: 'wt: command not found', exitCode: 127 },
    ]);

    await expect(
      repository.mergeCurrentWorktree({
        taskWorkspacePath: '/repo.task.task-123',
        baseBranchName: 'main',
      }),
    ).resolves.toEqual({
      workspaceStatus: 'merge_failed',
      mergeStatus: 'failed',
      mergeFailureReason: 'worktrunk_unavailable',
      mergeMessage: 'wt: command not found',
    });
  });
});