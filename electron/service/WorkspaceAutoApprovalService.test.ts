/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_service' */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WorkspaceAutoApprovalService } from './WorkspaceAutoApprovalService.js';

const createUserDataPath = async (name: string) =>
  fs.mkdtemp(path.join(os.tmpdir(), `nami-auto-approval-${name}-`));
const createWorkspacePath = async (name: string) =>
  fs.mkdtemp(path.join(os.tmpdir(), `nami-workspace-${name}-`));

describe('WorkspaceAutoApprovalService', () => {
  it('returns disabled config when no config file exists', async () => {
    const userDataPath = await createUserDataPath('default');
    const workspacePath = await createWorkspacePath('default');
    const service = new WorkspaceAutoApprovalService(userDataPath);

    await expect(service.getConfig(workspacePath)).resolves.toEqual({
      enabled: false,
    });
  });

  it('saves config under workspace/.nami/auto-approval-config.json', async () => {
    const userDataPath = await createUserDataPath('save');
    const workspacePath = await createWorkspacePath('save');
    const service = new WorkspaceAutoApprovalService(userDataPath);

    await service.saveConfig(workspacePath, { enabled: true });

    const savedContent = await fs.readFile(
      path.join(workspacePath, '.nami', 'auto-approval-config.json'),
      'utf-8',
    );
    expect(JSON.parse(savedContent)).toEqual({ enabled: true });
  });

  it('normalizes invalid persisted config values on read', async () => {
    const userDataPath = await createUserDataPath('normalized');
    const workspacePath = await createWorkspacePath('normalized');
    const service = new WorkspaceAutoApprovalService(userDataPath);

    await fs.mkdir(path.join(workspacePath, '.nami'), { recursive: true });
    await fs.writeFile(
      path.join(workspacePath, '.nami', 'auto-approval-config.json'),
      JSON.stringify({ enabled: 'yes' }, null, 2),
      'utf-8',
    );

    await expect(service.getConfig(workspacePath)).resolves.toEqual({
      enabled: false,
    });
  });
});
