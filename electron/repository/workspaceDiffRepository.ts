import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class WorkspaceDiffRepository {
  async snapshot(cwd: string): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync('git', [
        '-C',
        cwd,
        'diff',
        '--numstat',
        '--relative',
      ]);
      return stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }
}
