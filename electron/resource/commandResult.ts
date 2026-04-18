export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  errorCode?: string;
};

export const DEFAULT_LOGIN_SHELL =
  process.platform === 'darwin' ? '/bin/zsh' : '/bin/sh';

export const RESOLVE_WORKTRUNK_SHELL_ARGS = ['-l', '-c', 'command -v wt'];

export const REVIEW_DIFF_BASE_ARGS = [
  '--no-color',
  '--find-renames',
  '--unified=3',
];
