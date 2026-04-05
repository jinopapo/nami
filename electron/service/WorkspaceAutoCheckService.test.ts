import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAutoCheckEnv, WorkspaceAutoCheckService } from './WorkspaceAutoCheckService.js';

const createUserDataPath = async (name: string) => fs.mkdtemp(path.join(os.tmpdir(), `nami-auto-check-${name}-`));
const createWorkspacePath = async (name: string) => fs.mkdtemp(path.join(os.tmpdir(), `nami-workspace-${name}-`));

describe('buildAutoCheckEnv', () => {
  it('keeps existing PATH entries and appends common npm locations', () => {
    const env = buildAutoCheckEnv({ PATH: '/custom/bin:/usr/bin' });

    expect(env.PATH?.split(':')).toEqual([
      '/custom/bin',
      '/usr/bin',
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      '/usr/local/sbin',
      '/bin',
      '/usr/sbin',
      '/sbin',
    ]);
  });

  it('creates a usable PATH even when the base env does not include one', () => {
    const env = buildAutoCheckEnv({});

    expect(env.PATH?.split(':')).toEqual([
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      '/usr/local/sbin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
    ]);
  });
});

describe('WorkspaceAutoCheckService', () => {
  it('saves config under workspace/.nami/auto-check-config.json', async () => {
    const userDataPath = await createUserDataPath('save');
    const workspacePath = await createWorkspacePath('save');
    const service = new WorkspaceAutoCheckService(userDataPath);

    await service.saveConfig(workspacePath, { enabled: true, command: 'npm test' });

    const savedContent = await fs.readFile(path.join(workspacePath, '.nami', 'auto-check-config.json'), 'utf-8');
    expect(JSON.parse(savedContent)).toEqual({ enabled: true, command: 'npm test' });
  });

  it('reads config from workspace/.nami/auto-check-config.json', async () => {
    const userDataPath = await createUserDataPath('get');
    const workspacePath = await createWorkspacePath('get');
    const service = new WorkspaceAutoCheckService(userDataPath);

    await fs.mkdir(path.join(workspacePath, '.nami'), { recursive: true });
    await fs.writeFile(
      path.join(workspacePath, '.nami', 'auto-check-config.json'),
      JSON.stringify({ enabled: true, command: 'npm run lint' }, null, 2),
      'utf-8',
    );

    await expect(service.getConfig(workspacePath)).resolves.toEqual({ enabled: true, command: 'npm run lint' });
  });

  it('runs auto check commands with the supplemented PATH', async () => {
    const userDataPath = await createUserDataPath('run');
    const service = new WorkspaceAutoCheckService(userDataPath);

    const result = await service.run('/tmp', { enabled: true, command: 'command -v npm' });

    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toMatch(/npm$/);
  });
});