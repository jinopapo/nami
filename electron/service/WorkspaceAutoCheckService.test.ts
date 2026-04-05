import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAutoCheckEnv, WorkspaceAutoCheckService } from './WorkspaceAutoCheckService.js';

const createUserDataPath = async (name: string) => fs.mkdtemp(path.join(os.tmpdir(), `nami-auto-check-${name}-`));

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
  it('runs auto check commands with the supplemented PATH', async () => {
    const userDataPath = await createUserDataPath('run');
    const service = new WorkspaceAutoCheckService(userDataPath);

    const result = await service.run('/tmp', { enabled: true, command: 'command -v npm' });

    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toMatch(/npm$/);
  });
});