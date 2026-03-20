import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { agentInstances, ClineAgentMock } = vi.hoisted(() => {
  const instances: Array<{
    sessions: Map<string, {
      sessionId: string;
      cwd: string;
      mode: 'plan' | 'act';
      mcpServers: [];
      createdAt: number;
      lastActivityAt: number;
    }>;
    setPermissionHandler: ReturnType<typeof vi.fn>;
    initialize: ReturnType<typeof vi.fn>;
    newSession: ReturnType<typeof vi.fn>;
    prompt: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    emitterForSession: ReturnType<typeof vi.fn>;
  }> = [];
  const mock = vi.fn(
    class {
      sessions = new Map();
      setPermissionHandler = vi.fn();
      initialize = vi.fn();
      newSession = vi.fn();
      prompt = vi.fn();
      cancel = vi.fn();
      emitterForSession = vi.fn();

      constructor() {
        const emitter = { on: vi.fn() };
        this.emitterForSession.mockReturnValue(emitter);
        this.newSession.mockImplementation(async ({ cwd }: { cwd: string }) => {
          const session = {
            sessionId: 'new-session',
            cwd,
            mode: 'plan' as const,
            mcpServers: [],
            createdAt: Date.parse('2026-03-19T00:00:00.000Z'),
            lastActivityAt: Date.parse('2026-03-19T00:00:00.000Z'),
          };
          this.sessions.set(session.sessionId, session);
          return { sessionId: session.sessionId, modes: { currentModeId: 'plan' } };
        });
        this.prompt.mockResolvedValue({ stopReason: 'completed' });
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

const createUserDataPath = async (name: string) => fs.mkdtemp(path.join(os.tmpdir(), `nami-${name}-`));

const addMockSession = (sessionId: string, cwd = '/tmp') => {
  agentInstances[0]?.sessions.set(sessionId, {
    sessionId,
    cwd,
    mode: 'plan',
    mcpServers: [],
    createdAt: Date.parse('2026-03-19T00:00:00.000Z'),
    lastActivityAt: Date.parse('2026-03-19T00:00:00.000Z'),
  });
};

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

  it('resumes a persisted session before returning it', async () => {
    const userDataPath = await createUserDataPath('resume-session');
    const service = new ClineSessionService(userDataPath);
    addMockSession('session-1');

    const session = await service.resumeSession('session-1');

    expect(agentInstances[0]?.emitterForSession).toHaveBeenCalledTimes(1);
    expect(session).toMatchObject({
      sessionId: 'session-1',
      cwd: '/tmp',
      mode: 'plan',
    });
  });

  it('creates a fresh session and sends the prompt there', async () => {
    const userDataPath = await createUserDataPath('send-message');
    const service = new ClineSessionService(userDataPath);
    addMockSession('session-1');

    const session = await service.sendMessage({ sessionId: 'session-1', text: 'hello' });

    expect(agentInstances[0]?.newSession).toHaveBeenCalledTimes(1);
    expect(agentInstances[0]?.prompt).toHaveBeenCalledWith({
      sessionId: 'new-session',
      prompt: [{ type: 'text', text: 'hello' }],
    });
    expect(session.sessionId).toBe('new-session');
  });

  it('does not attach duplicate listeners when the same session is resumed multiple times', async () => {
    const userDataPath = await createUserDataPath('duplicate-listeners');
    const service = new ClineSessionService(userDataPath);

    await service.createSession({ cwd: '/tmp' });

    await service.resumeSession('new-session');
    await service.resumeSession('new-session');

    const emitter = agentInstances[0]?.emitterForSession.mock.results[0]?.value as { on: ReturnType<typeof vi.fn> };
    expect(agentInstances[0]?.emitterForSession).toHaveBeenCalledTimes(1);
    expect(emitter.on).toHaveBeenCalledTimes(ACP_EVENT_COUNT + 1);
  });

  it('throws when trying to resume a missing session', async () => {
    const userDataPath = await createUserDataPath('missing-session');
    const service = new ClineSessionService(userDataPath);

    await expect(service.resumeSession('session-1')).rejects.toThrow('Session not found: session-1');
  });
});

const ACP_EVENT_COUNT = 10;
