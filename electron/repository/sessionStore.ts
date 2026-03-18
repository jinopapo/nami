import fs from 'node:fs/promises';
import path from 'node:path';
import type { StoredChatState, StoredSessionRecord } from '../entity/chat.js';

const EMPTY_STATE: StoredChatState = { sessions: [] };

export class SessionStore {
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
    const state = await this.readState();
    const nextSessions = state.sessions.filter((item) => item.sessionId !== session.sessionId);
    nextSessions.push(session);
    await this.writeState({ sessions: nextSessions });
  }

  async appendEvent(sessionId: string, event: unknown): Promise<void> {
    const state = await this.readState();
    const session = state.sessions.find((item) => item.sessionId === sessionId);

    if (!session) {
      return;
    }

    session.events.push(event);
    await this.writeState(state);
  }

  private async readState(): Promise<StoredChatState> {
    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(content) as StoredChatState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return EMPTY_STATE;
      }

      throw error;
    }
  }

  private async writeState(state: StoredChatState): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(state, null, 2), 'utf8');
  }
}
