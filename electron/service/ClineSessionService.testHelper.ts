import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';

export const flushPromises = async (count = 1): Promise<void> => {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
};

export const waitForAsyncWork = async (): Promise<void> => {
  await flushPromises(4);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushPromises(4);
};

export const waitUntil = async (
  assertion: () => void,
  attempts = 20,
): Promise<void> => {
  let lastError: unknown;
  for (let index = 0; index < attempts; index += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await waitForAsyncWork();
    }
  }

  throw lastError;
};

type MockAgentInstance = {
  sessions: Map<
    string,
    {
      sessionId: string;
      cwd: string;
      mode: 'plan' | 'act';
      mcpServers: [];
      createdAt: number;
      lastActivityAt: number;
    }
  >;
  setPermissionHandler: ReturnType<typeof vi.fn>;
  initialize: ReturnType<typeof vi.fn>;
  newSession: ReturnType<typeof vi.fn>;
  prompt: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  setSessionMode: ReturnType<typeof vi.fn>;
  emitterForSession: ReturnType<typeof vi.fn>;
};

export const agentInstances: MockAgentInstance[] = [];

export const ClineAgentMock = vi.fn(
  class {
    sessions = new Map();
    setPermissionHandler = vi.fn();
    initialize = vi.fn();
    newSession = vi.fn();
    prompt = vi.fn();
    cancel = vi.fn();
    setSessionMode = vi.fn();
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
        return {
          sessionId: session.sessionId,
          modes: { currentModeId: 'plan' },
        };
      });
      this.prompt.mockResolvedValue({ stopReason: 'completed' });
      this.setSessionMode.mockImplementation(
        async ({
          sessionId,
          modeId,
        }: {
          sessionId: string;
          modeId: 'plan' | 'act';
        }) => {
          const session = this.sessions.get(sessionId);
          if (session) {
            session.mode = modeId;
          }
          return {};
        },
      );
      agentInstances.push(this as MockAgentInstance);
    }
  },
);

vi.mock('cline', () => ({
  ClineAgent: ClineAgentMock,
}));

export const createUserDataPath = async (name: string): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), `nami-${name}-`));

export const resetClineTestState = (originalClineDir?: string): void => {
  agentInstances.length = 0;
  ClineAgentMock.mockClear();
  if (originalClineDir === undefined) {
    delete process.env.CLINE_DIR;
  } else {
    process.env.CLINE_DIR = originalClineDir;
  }
  vi.restoreAllMocks();
};

export const ACP_EVENT_COUNT = 10;
