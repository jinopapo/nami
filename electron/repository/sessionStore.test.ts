import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { StoredSessionRecord } from '../entity/chat.js';
import { SessionStore } from './sessionStore.js';

const tempDirectories: string[] = [];

const createSession = (sessionId: string): StoredSessionRecord => ({
  sessionId,
  title: `Session ${sessionId}`,
  cwd: '/tmp/workspace',
  createdAt: '2026-03-18T12:00:00.000Z',
  updatedAt: '2026-03-18T12:00:00.000Z',
  mode: 'plan',
  live: true,
  archived: false,
  events: [],
});

const createStore = async () => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'nami-session-store-'));
  tempDirectories.push(tempDirectory);
  return new SessionStore(path.join(tempDirectory, 'nami-chat.json'));
};

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('SessionStore', () => {
  it('serializes concurrent writes without corrupting the store', async () => {
    const store = await createStore();
    const session = createSession('session-1');

    await store.saveSession(session);
    await Promise.all([
      store.appendEvent(session.sessionId, { id: 'event-1' }),
      store.appendEvent(session.sessionId, { id: 'event-2' }),
      store.appendEvent(session.sessionId, { id: 'event-3' }),
    ]);

    const savedSession = await store.getSession(session.sessionId);
    expect(savedSession?.events).toEqual([
      { id: 'event-1' },
      { id: 'event-2' },
      { id: 'event-3' },
    ]);
  });

  it('throws a descriptive error when the session store is corrupted', async () => {
    const store = await createStore();
    const filePath = path.join(tempDirectories.at(-1) as string, 'nami-chat.json');

    await fs.writeFile(filePath, '{"sessions":[]}}BROKEN', 'utf8');

    await expect(store.listSessions()).resolves.toEqual([]);

    const directoryEntries = await fs.readdir(path.dirname(filePath));
    expect(directoryEntries.some((entry) => entry.startsWith('nami-chat.json.corrupted-') && entry.endsWith('.bak'))).toBe(true);
    await expect(fs.access(filePath)).rejects.toThrow();
  });
});