import os from 'node:os';
import path from 'node:path';
import {
  ClineAgent,
  type ClineAcpSession,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
} from 'cline';

const resolveClineDir = (): string => path.join(os.homedir(), '.cline');

export class ClineAgentService {
  private readonly agent: ClineAgent;

  constructor() {
    this.agent = new ClineAgent({
      clineDir: resolveClineDir(),
      debug: false,
    });
  }

  async initialize(): Promise<void> {
    await this.agent.initialize({
      protocolVersion: 1,
      clientCapabilities: {},
    });
  }

  setPermissionHandler(
    handler: (
      request: RequestPermissionRequest,
    ) => Promise<RequestPermissionResponse>,
  ): void {
    this.agent.setPermissionHandler(handler);
  }

  newSession(input: { cwd: string }): Promise<{ sessionId: string }> {
    return this.agent.newSession({
      cwd: input.cwd,
      mcpServers: [],
    });
  }

  prompt(input: {
    sessionId: string;
    prompt: string;
  }): Promise<{ stopReason?: string }> {
    return this.agent.prompt({
      sessionId: input.sessionId,
      prompt: [{ type: 'text', text: input.prompt }],
    });
  }

  cancel(input: { sessionId: string }): Promise<void> {
    return this.agent.cancel(input);
  }

  setSessionMode(input: {
    sessionId: string;
    modeId: 'plan' | 'act';
  }): Promise<unknown> {
    return this.agent.setSessionMode(input);
  }

  getSession(sessionId: string): ClineAcpSession {
    const session = this.agent.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  emitterForSession(
    sessionId: string,
  ): ReturnType<ClineAgent['emitterForSession']> {
    return this.agent.emitterForSession(sessionId);
  }
}
