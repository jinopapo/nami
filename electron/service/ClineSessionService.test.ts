import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { agentInstances, ClineAgentMock } = vi.hoisted(() => {
  const instances: Array<{ setPermissionHandler: ReturnType<typeof vi.fn> }> = [];
  const mock = vi.fn(
    class {
      setPermissionHandler = vi.fn();
      initialize = vi.fn();
      newSession = vi.fn();
      prompt = vi.fn();
      cancel = vi.fn();
      emitterForSession = vi.fn();

      constructor() {
        instances.push(this);
      }
    },
  );

  return {
    agentInstances: instances,
    ClineAgentMock: mock,
  };
});

vi.mock('cline', () => ({
  ClineAgent: ClineAgentMock,
}));

import { ClineSessionService, resolveClineDir } from './ClineSessionService.js';

describe('resolveClineDir', () => {
  afterEach(() => {
    agentInstances.length = 0;
    ClineAgentMock.mockClear();
    vi.restoreAllMocks();
  });

  it('always resolves to ~/.cline', () => {
    vi.spyOn(os, 'homedir').mockReturnValue('/Users/tester');

    expect(resolveClineDir()).toBe(path.join('/Users/tester', '.cline'));
  });

  it('ignores CLINE_DIR when it is set', () => {
    process.env.CLINE_DIR = '/tmp/shared-cline';
    vi.spyOn(os, 'homedir').mockReturnValue('/Users/tester');

    expect(resolveClineDir()).toBe(path.join('/Users/tester', '.cline'));
  });
});

describe('ClineSessionService', () => {
  const originalClineDir = process.env.CLINE_DIR;

  afterEach(() => {
    agentInstances.length = 0;
    ClineAgentMock.mockClear();
    process.env.CLINE_DIR = originalClineDir;
    vi.restoreAllMocks();
  });

  it('constructs ClineAgent with the resolved shared clineDir', () => {
    process.env.CLINE_DIR = '/tmp/shared-cline';
    vi.spyOn(os, 'homedir').mockReturnValue('/Users/tester');

    new ClineSessionService('/tmp/nami-user-data');

    expect(ClineAgentMock).toHaveBeenCalledWith({
      clineDir: path.join('/Users/tester', '.cline'),
      debug: false,
    });
    expect(agentInstances[0]?.setPermissionHandler).toHaveBeenCalledTimes(1);
  });
});
