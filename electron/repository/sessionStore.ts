import fs from 'node:fs/promises';
import path from 'node:path';
import type { StoredChatState, StoredSessionRecord } from '../entity/chat.js';

const EMPTY_STATE: StoredChatState = { sessions: [] };

export class SessionStore {
  private writeQueue: Promise<void> = Promise.resolve();
  private recoveryPromise: Promise<void> | null = null;

  constructor(private readonly filePath: string) {}

  async listSessions(): Promise<StoredSessionRecord[]> {
    const state = await this.readState();
    return state.sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async getSession(sessionId: string): Promise<StoredSessionRecord | undefined> {
    const state = await this.readState();
    return state.sessions.find((session) => session.sessionId === sessionId);
  }

  async saveSession(session: StoredSessionRecord): Promise<void> {
    await this.updateState((state) => {
      const nextSessions = state.sessions.filter((item) => item.sessionId !== session.sessionId);
      nextSessions.push(session);
      return { sessions: nextSessions };
    });
  }

  async appendEvent(sessionId: string, event: unknown): Promise<void> {
    await this.updateState((state) => {
      const session = state.sessions.find((item) => item.sessionId === sessionId);

      if (!session) {
        return state;
      }

      session.events.push(event);
      return state;
    });
  }

  private async readState(): Promise<StoredChatState> {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(content) as StoredChatState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return EMPTY_STATE;
      }

      if (error instanceof SyntaxError) {
        await this.recoverCorruptedFile();
        return EMPTY_STATE;
      }

      throw error;
    }
  }

  private async recoverCorruptedFile(): Promise<void> {
    if (!this.recoveryPromise) {
      this.recoveryPromise = (async () => {
        const backupPath = `${this.filePath}.corrupted-${Date.now()}.bak`;
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        await fs.rename(this.filePath, backupPath);
      })().finally(() => {
        this.recoveryPromise = null;
      });
    }

    await this.recoveryPromise;
  }

  private async updateState(updater: (state: StoredChatState) => StoredChatState): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      const state = await this.readState();
      const nextState = updater(state);
      await this.writeState(nextState);
    });

    this.writeQueue = operation.catch(() => undefined);
    await operation;
  }

  private async writeState(state: StoredChatState): Promise<void> {
    const directoryPath = path.dirname(this.filePath);
    const tempPath = `${this.filePath}.${process.pid}.tmp`;

    await fs.mkdir(directoryPath, { recursive: true });
    await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
    await fs.rename(tempPath, this.filePath);
  }
}
