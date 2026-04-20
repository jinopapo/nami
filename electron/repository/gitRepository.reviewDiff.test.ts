/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_repository'. Dependency is of type 'electron_repository' */
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

describe('GitRepository review diff', () => {
  it('loads review diff from the task workspace against base branch', async () => {
    const repository = new TestGitRepository([
      { stdout: 'abc123\n', stderr: '', exitCode: 0 },
      {
        stdout: `diff --git a/a.ts b/a.ts
index 1111111..2222222 100644
--- a/a.ts
+++ b/a.ts
@@ -1,1 +1,1 @@
-const before = 1;
+const after = 2;
`,
        stderr: '',
        exitCode: 0,
      },
      { stdout: '', stderr: '', exitCode: 0 },
    ]);

    await expect(
      repository.getReviewDiff({
        taskWorkspacePath: '/repo.task.task-123',
        baseBranchName: 'main',
      }),
    ).resolves.toEqual([
      {
        path: 'a.ts',
        oldPath: 'a.ts',
        newPath: 'a.ts',
        status: 'modified',
        hunks: [
          {
            header: '@@ -1,1 +1,1 @@',
            rows: [
              {
                left: {
                  text: 'const before = 1;',
                  lineNumber: 1,
                  changeType: 'removed',
                },
                right: {
                  text: 'const after = 2;',
                  lineNumber: 1,
                  changeType: 'added',
                },
              },
            ],
          },
        ],
      },
    ]);

    expect(repository.calls).toEqual([
      {
        command: 'git',
        args: ['merge-base', 'main', 'HEAD'],
        cwd: '/repo.task.task-123',
      },
      {
        command: 'git',
        args: ['diff', '--no-color', '--find-renames', '--unified=3', 'abc123'],
        cwd: '/repo.task.task-123',
      },
      {
        command: 'git',
        args: ['ls-files', '--others', '--exclude-standard'],
        cwd: '/repo.task.task-123',
      },
    ]);
  });

  it('includes untracked files in review diff', async () => {
    const repository = new TestGitRepository([
      { stdout: 'abc123\n', stderr: '', exitCode: 0 },
      { stdout: '', stderr: '', exitCode: 0 },
      { stdout: 'new-file.ts\n', stderr: '', exitCode: 0 },
      {
        stdout: `diff --git a/new-file.ts b/new-file.ts
new file mode 100644
index 0000000..2222222
--- /dev/null
+++ b/new-file.ts
@@ -0,0 +1,2 @@
+export const created = true;
+export const value = 1;
`,
        stderr: '',
        exitCode: 1,
      },
    ]);

    await expect(
      repository.getReviewDiff({
        taskWorkspacePath: '/repo.task.task-123',
        baseBranchName: 'main',
      }),
    ).resolves.toEqual([
      {
        path: 'new-file.ts',
        oldPath: undefined,
        newPath: 'new-file.ts',
        status: 'added',
        hunks: [
          {
            header: '@@ -0,0 +1,2 @@',
            rows: [
              {
                left: {
                  text: '',
                  changeType: 'empty',
                },
                right: {
                  text: 'export const created = true;',
                  lineNumber: 1,
                  changeType: 'added',
                },
              },
              {
                left: {
                  text: '',
                  changeType: 'empty',
                },
                right: {
                  text: 'export const value = 1;',
                  lineNumber: 2,
                  changeType: 'added',
                },
              },
            ],
          },
        ],
      },
    ]);

    expect(repository.calls).toEqual([
      {
        command: 'git',
        args: ['merge-base', 'main', 'HEAD'],
        cwd: '/repo.task.task-123',
      },
      {
        command: 'git',
        args: ['diff', '--no-color', '--find-renames', '--unified=3', 'abc123'],
        cwd: '/repo.task.task-123',
      },
      {
        command: 'git',
        args: ['ls-files', '--others', '--exclude-standard'],
        cwd: '/repo.task.task-123',
      },
      {
        command: 'git',
        args: [
          'diff',
          '--no-color',
          '--find-renames',
          '--unified=3',
          '--no-index',
          '--',
          '/dev/null',
          'new-file.ts',
        ],
        cwd: '/repo.task.task-123',
      },
    ]);
  });
});
