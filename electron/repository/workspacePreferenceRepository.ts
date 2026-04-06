import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type WorkspacePreference = {
  lastSelectedWorkspace?: string;
};

export class WorkspacePreferenceRepository {
  private readonly filePath: string;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, 'workspace-preferences.json');
  }

  async getLastSelectedWorkspace(): Promise<string | undefined> {
    const preference = await this.readPreference();
    return preference.lastSelectedWorkspace;
  }

  async saveLastSelectedWorkspace(workspacePath: string): Promise<void> {
    await this.writePreference({ lastSelectedWorkspace: workspacePath });
  }

  private async readPreference(): Promise<WorkspacePreference> {
    try {
      const content = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content) as WorkspacePreference;
      return typeof parsed.lastSelectedWorkspace === 'string'
        ? { lastSelectedWorkspace: parsed.lastSelectedWorkspace }
        : {};
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return {};
      }

      console.error('[workspace-preference] Failed to read preference file', {
        filePath: this.filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    }
  }

  private async writePreference(
    preference: WorkspacePreference,
  ): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(
      this.filePath,
      JSON.stringify(preference, null, 2),
      'utf-8',
    );
  }

  private isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
    return (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    );
  }
}
