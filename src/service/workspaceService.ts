export const getWorkspaceLabel = (cwd: string, homeDir?: string) => {
  if (!cwd) {
    return 'No directory selected';
  }

  if (!homeDir) {
    return cwd;
  }

  if (cwd === homeDir) {
    return '~';
  }

  const homePrefix = `${homeDir}/`;
  if (cwd.startsWith(homePrefix)) {
    return `~/${cwd.slice(homePrefix.length)}`;
  }

  return cwd;
};
