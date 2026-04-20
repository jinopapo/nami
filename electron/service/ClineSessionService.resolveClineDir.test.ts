/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_service' */
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveClineDir } from './ClineSessionService.js';
import { resetClineTestState } from './ClineSessionService.testHelper.js';

describe('resolveClineDir', () => {
  afterEach(() => {
    resetClineTestState();
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
