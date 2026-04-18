import { describe, expect, it } from 'vitest';
import { GitRepository } from './gitRepository.js';

type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  errorCode?: string;
};

class TestGitRepository extends GitRepository {
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

describe('GitRepository', () => {
  it('gets the current git branch from the project workspace', async () => {
    const repository = new TestGitRepository([
      { stdout: 'feature/header-branch\n', stderr: '', exitCode: 0 },
    ]);

    await expect(repository.getCurrentBranch('/repo')).resolves.toBe(
      'feature/header-branch',
    );

    expect(repository.calls).toEqual([
      {
        command: 'git',
        args: ['branch', '--show-current'],
        cwd: '/repo',
      },
    ]);
  });

  it('resolves a worktree path from git worktree list output', async () => {
    const repository = new TestGitRepository([
      {
        stdout:
          'worktree /repo.task.task-123\nbranch refs/heads/task/task-123\n',
        stderr: '',
        exitCode: 0,
      },
    ]);

    await expect(
      repository.getWorktreePath('/repo', 'task/task-123'),
    ).resolves.toBe('/repo.task.task-123');

    expect(repository.calls).toEqual([
      {
        command: 'git',
        args: ['worktree', 'list', '--porcelain'],
        cwd: '/repo',
      },
    ]);
  });

  it('stages, commits, and resolves the resulting commit hash', async () => {
    const repository = new TestGitRepository([
      { stdout: '', stderr: '', exitCode: 0 },
      {
        stdout: '[task/task-123 abc123] feat: review commit',
        stderr: '',
        exitCode: 0,
      },
      { stdout: 'abc123\n', stderr: '', exitCode: 0 },
    ]);

    await expect(
      repository.commitReview({
        taskWorkspacePath: '/repo.task.task-123',
        message: 'feat: review commit',
      }),
    ).resolves.toEqual({
      commitHash: 'abc123',
      output: '[task/task-123 abc123] feat: review commit',
    });

    expect(repository.calls).toEqual([
      {
        command: 'git',
        args: ['add', '-A'],
        cwd: '/repo.task.task-123',
      },
      {
        command: 'git',
        args: ['commit', '--message', 'feat: review commit'],
        cwd: '/repo.task.task-123',
      },
      {
        command: 'git',
        args: ['rev-parse', 'HEAD'],
        cwd: '/repo.task.task-123',
      },
    ]);
  });
});
