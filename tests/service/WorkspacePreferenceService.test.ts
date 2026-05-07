import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WorkspacePreferenceService } from '../../electron/service/WorkspacePreferenceService.js';

const createUserDataPath = async (name: string) =>
  fs.mkdtemp(path.join(os.tmpdir(), `nami-workspace-preference-${name}-`));

describe('WorkspacePreferenceService', () => {
  it('returns undefined when no preference has been saved yet', async () => {
    const userDataPath = await createUserDataPath('empty');
    const service = new WorkspacePreferenceService(userDataPath);

    await expect(service.getLastSelectedWorkspace()).resolves.toBeUndefined();
  });

  it('saves and reads the last selected workspace', async () => {
    const userDataPath = await createUserDataPath('save');
    const service = new WorkspacePreferenceService(userDataPath);

    await service.saveLastSelectedWorkspace('/tmp/project-workspace');

    await expect(service.getLastSelectedWorkspace()).resolves.toBe(
      '/tmp/project-workspace',
    );
  });
});
