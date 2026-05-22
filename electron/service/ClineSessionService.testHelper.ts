import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';

const flushPromises = async (count = 1): Promise<void> => {
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
  subscribeSession: ReturnType<typeof vi.fn>;
  getSession: ReturnType<typeof vi.fn>;
};

export const agentInstances: MockAgentInstance[] = [];

const createSessionUpdate = (sessionUpdate: string, payload: unknown) => ({
  type: 'session-update' as const,
  update: {
    sessionUpdate,
    ...(typeof payload === 'object' && payload !== null ? payload : {}),
  },
});

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
    subscribeSession = vi.fn();
    getSession = vi.fn();

    constructor() {
      const emitter = { on: vi.fn() };
      this.emitterForSession.mockReturnValue(emitter);
      this.newSession.mockImplementation(async ({ cwd }: { cwd: string }) => {
        const sessionId = `new-session-${this.sessions.size + 1}`;
        const session = {
          sessionId,
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
      this.getSession.mockImplementation((sessionId: string) => {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`Session not found: ${sessionId}`);
        return session;
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
          const listeners = this.subscribeSession.mock.calls
            .filter((call) => call[0] === sessionId)
            .map((call) => call[1] as (event: unknown) => void);
          listeners.forEach((listener) =>
            listener({
              type: 'session-update',
              update: {
                sessionUpdate: 'current_mode_update',
                currentModeId: modeId,
              },
            }),
          );
          return {};
        },
      );
      this.subscribeSession.mockImplementation(
        (sessionId: string, listener: (event: unknown) => void) => {
          const sessionEmitter = this.emitterForSession(sessionId);
          ACP_EVENTS_FOR_MOCK.forEach((eventName) => {
            sessionEmitter.on(eventName, (payload: unknown) => {
              listener(createSessionUpdate(eventName, payload));
            });
          });
          sessionEmitter.on('error', () => {
            listener({ type: 'session-ended', stopReason: 'error' });
          });
          return vi.fn();
        },
      );
      agentInstances.push(this as MockAgentInstance);
    }
  },
);

const ACP_EVENTS_FOR_MOCK = [
  'user_message_chunk',
  'agent_message_chunk',
  'agent_thought_chunk',
  'tool_call',
  'tool_call_update',
  'plan',
  'available_commands_update',
  'current_mode_update',
  'config_option_update',
  'session_info_update',
] as const;

vi.mock('./ClineSdkAgentService.js', () => ({
  ClineSdkAgentService: ClineAgentMock,
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

vi.mock('../repository/workTrunkRepository.js', () => ({
  WorkTrunkRepository: class {
    async createWorktree({
      projectWorkspacePath,
      taskBranchName,
    }: {
      projectWorkspacePath: string;
      taskBranchName: string;
    }) {
      return {
        taskWorkspacePath: `${projectWorkspacePath}.${taskBranchName.replaceAll('/', '.')}`,
        taskBranchName,
        baseBranchName: 'main',
      };
    }

    async copyIgnoredFiles() {}

    async removeWorktree() {}

    async mergeCurrentWorktree() {
      return {
        workspaceStatus: 'merged' as const,
        mergeStatus: 'succeeded' as const,
        mergeMessage: 'merged',
      };
    }
  },
}));

vi.mock('../repository/gitRepository.js', () => ({
  GitRepository: class {
    async getCurrentBranch() {
      return 'main';
    }

    async getWorktreePath(
      projectWorkspacePath: string,
      taskBranchName: string,
    ) {
      return `${projectWorkspacePath}.${taskBranchName.replaceAll('/', '.')}`;
    }

    async removeWorktree() {}

    async getReviewDiff() {
      return [];
    }

    async commitReview() {
      return {
        commitHash: 'mock-commit-hash',
        output: 'mock commit output',
      };
    }
  },
}));
