import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { agentInstances, ClineAgentMock } = vi.hoisted(() => {
  const instances: Array<{
    setPermissionHandler: ReturnType<typeof vi.fn>;
    initialize: ReturnType<typeof vi.fn>;
    newSession: ReturnType<typeof vi.fn>;
    prompt: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    emitterForSession: ReturnType<typeof vi.fn>;
  }> = [];
  const mock = vi.fn(
    class {
      setPermissionHandler = vi.fn();
      initialize = vi.fn();
      newSession = vi.fn();
      prompt = vi.fn();
      cancel = vi.fn();
      emitterForSession = vi.fn();

      constructor() {
        const emitter = { on: vi.fn() };
        this.emitterForSession.mockReturnValue(emitter);
        this.newSession.mockResolvedValue({ sessionId: 'new-session', modes: { currentModeId: 'plan' } });
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

const createStoredSession = (overrides: Partial<{
  sessionId: string;
  parentSessionId?: string;
  title: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  live: boolean;
  archived: boolean;
  archivedAt?: string;
  events: unknown[];
}> = {}) => ({
  sessionId: overrides.sessionId ?? 'session-1',
  parentSessionId: overrides.parentSessionId,
  title: overrides.title ?? 'Test Session',
  cwd: overrides.cwd ?? '/tmp',
  createdAt: overrides.createdAt ?? '2026-03-19T00:00:00.000Z',
  updatedAt: overrides.updatedAt ?? '2026-03-19T00:00:00.000Z',
  mode: overrides.mode ?? 'plan',
  live: overrides.live ?? true,
  archived: overrides.archived ?? false,
  archivedAt: overrides.archivedAt,
  events: overrides.events ?? [],
});

const writeStore = async (userDataPath: string, sessions: unknown[]) => {
  await fs.mkdir(userDataPath, { recursive: true });
  await fs.writeFile(path.join(userDataPath, 'nami-chat.json'), JSON.stringify({ sessions }, null, 2), 'utf8');
};

const createUserDataPath = async (name: string) => fs.mkdtemp(path.join(os.tmpdir(), `nami-${name}-`));

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
    await writeStore(userDataPath, [createStoredSession()]);
    const service = new ClineSessionService(userDataPath);

    const session = await service.resumeSession('session-1');

    expect(agentInstances[0]?.emitterForSession).not.toHaveBeenCalled();
    expect(session).toMatchObject({
      sessionId: 'session-1',
      mode: 'plan',
      live: true,
      archived: false,
    });
  });

  it('creates a fresh session and sends the prompt there', async () => {
    const userDataPath = await createUserDataPath('send-message');
    await writeStore(userDataPath, [createStoredSession()]);
    const service = new ClineSessionService(userDataPath);

    const session = await service.sendMessage({ sessionId: 'session-1', text: 'hello' });

    expect(agentInstances[0]?.newSession).toHaveBeenCalledTimes(1);
    expect(agentInstances[0]?.prompt).toHaveBeenCalledWith({
      sessionId: 'new-session',
      prompt: [{ type: 'text', text: 'hello' }],
    });
    expect(session.sessionId).toBe('new-session');
    expect(session.parentSessionId).toBe('session-1');
  });

  it('creates a fresh session even when the source session is archived', async () => {
    const userDataPath = await createUserDataPath('archived-session');
    await writeStore(userDataPath, [createStoredSession({ archived: true })]);
    const service = new ClineSessionService(userDataPath);

    const session = await service.sendMessage({ sessionId: 'session-1', text: 'hello' });

    expect(agentInstances[0]?.newSession).toHaveBeenCalledTimes(1);
    expect(agentInstances[0]?.prompt).toHaveBeenCalledWith({
      sessionId: 'new-session',
      prompt: [{ type: 'text', text: 'hello' }],
    });
    expect(session.sessionId).toBe('new-session');
  });

  it('rejects resuming sessions that are no longer live in this process', async () => {
    const userDataPath = await createUserDataPath('archived-resume-session');
    await writeStore(userDataPath, [createStoredSession({ archived: true, live: false })]);
    const service = new ClineSessionService(userDataPath);

    await expect(service.resumeSession('session-1')).rejects.toThrow(
      'This session is no longer active in the current app process and cannot be resumed. Send a new message to continue in a new session.',
    );
  });

  it('still sends a message for archived sessions because sending always creates a new session', async () => {
    const userDataPath = await createUserDataPath('archived-no-resume');
    await writeStore(userDataPath, [createStoredSession({ archived: true, live: false })]);
    const service = new ClineSessionService(userDataPath);

    await expect(service.sendMessage({ sessionId: 'session-1', text: 'hello' })).resolves.toMatchObject({
      sessionId: 'new-session',
      parentSessionId: 'session-1',
    });
  });

  it('does not attach duplicate listeners when the same session is resumed multiple times', async () => {
    const userDataPath = await createUserDataPath('duplicate-listeners');
    await writeStore(userDataPath, [createStoredSession({ sessionId: 'new-session' })]);
    const service = new ClineSessionService(userDataPath);

    await service.createSession({ cwd: '/tmp', title: 'Test Session' });

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
