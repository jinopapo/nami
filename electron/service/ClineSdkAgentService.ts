import { randomUUID } from 'node:crypto';
import type {
  SessionEvent,
  ToolPermissionRequest,
  ToolPermissionResponse,
} from '../entity/clineSession.js';
import type {
  ClineSdkRuntimeConfig,
  ClineSdkRuntimeSession,
} from '../entity/clineSdkConfig.js';
import { ClineSdkAgentRepository } from '../repository/clineSdkAgentRepository.js';

type ConfigServicePort = {
  createCoreSessionConfig(cwd: string): Promise<ClineSdkRuntimeConfig>;
};

type AgentRepositoryPort = {
  initialize(input: {
    requestToolApproval: (
      request: ToolPermissionRequest,
    ) => Promise<ToolPermissionResponse>;
  }): Promise<void>;
  start(input: {
    prompt: string;
    config: ClineSdkRuntimeConfig & {
      sessionId: string;
      mode: 'plan' | 'act';
      systemPrompt: string;
      enableSpawnAgent: false;
      enableAgentTeams: false;
      workspaceRoot: string;
    };
    requestToolApproval: (
      request: ToolPermissionRequest,
    ) => Promise<ToolPermissionResponse>;
  }): Promise<{ stopReason?: string }>;
  send(input: {
    sessionId: string;
    prompt: string;
    mode: 'plan' | 'act';
  }): Promise<{ stopReason?: string }>;
  abort(input: { sessionId: string; reason: string }): Promise<void>;
  subscribe(
    listener: (event: SessionEvent & { sessionId: string }) => void,
  ): () => void;
  dispose(): Promise<void>;
};

type SessionListener = (event: SessionEvent) => void;

const defaultSystemPrompt =
  'You are Cline running inside nami. Follow the user request and respect the current workspace.';

export class ClineSdkAgentService {
  private unsubscribeRepository: (() => void) | undefined;
  private readonly sessions = new Map<string, ClineSdkRuntimeSession>();
  private readonly pendingSessions = new Set<string>();
  private readonly listenersBySession = new Map<string, Set<SessionListener>>();
  private permissionHandler:
    | ((request: ToolPermissionRequest) => Promise<ToolPermissionResponse>)
    | undefined;

  constructor(
    private readonly configService: ConfigServicePort,
    private readonly repository: AgentRepositoryPort = new ClineSdkAgentRepository(),
  ) {}

  async initialize(): Promise<void> {
    await this.repository.initialize({
      requestToolApproval: (request) => this.handleToolApproval(request),
    });
    if (!this.unsubscribeRepository) {
      this.unsubscribeRepository = this.repository.subscribe((event) => {
        const { sessionId, ...mappedEvent } = event;
        this.publishSessionEvent(sessionId, mappedEvent as SessionEvent);
      });
    }
  }

  setPermissionHandler(
    handler: (
      request: ToolPermissionRequest,
    ) => Promise<ToolPermissionResponse>,
  ): void {
    this.permissionHandler = handler;
  }

  newSession(input: { cwd: string }): Promise<{ sessionId: string }> {
    const now = new Date().toISOString();
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      sessionId,
      cwd: input.cwd,
      mode: 'plan',
      createdAt: now,
      lastActivityAt: now,
    });
    this.pendingSessions.add(sessionId);
    return Promise.resolve({ sessionId });
  }

  async prompt(input: {
    sessionId: string;
    prompt: string;
  }): Promise<{ stopReason?: string }> {
    await this.initialize();
    const session = this.getSession(input.sessionId);
    this.touchSession(input.sessionId);

    if (this.pendingSessions.has(input.sessionId)) {
      const config = await this.configService.createCoreSessionConfig(
        session.cwd,
      );
      const result = await this.repository.start({
        prompt: input.prompt,
        config: {
          ...config,
          sessionId: input.sessionId,
          mode: session.mode,
          systemPrompt: defaultSystemPrompt,
          enableSpawnAgent: false,
          enableAgentTeams: false,
          workspaceRoot: config.cwd,
        },
        requestToolApproval: (request) => this.handleToolApproval(request),
      });
      this.pendingSessions.delete(input.sessionId);
      return result;
    }

    return this.repository.send({
      sessionId: input.sessionId,
      prompt: input.prompt,
      mode: session.mode,
    });
  }

  async cancel(input: { sessionId: string }): Promise<void> {
    await this.initialize();
    await this.repository.abort({
      sessionId: input.sessionId,
      reason: 'User cancelled',
    });
    this.touchSession(input.sessionId);
  }

  setSessionMode(input: {
    sessionId: string;
    modeId: 'plan' | 'act';
  }): Promise<void> {
    const session = this.getSession(input.sessionId);
    this.sessions.set(input.sessionId, {
      ...session,
      mode: input.modeId,
      lastActivityAt: new Date().toISOString(),
    });
    this.publishSessionEvent(input.sessionId, {
      type: 'session-update',
      update: {
        sessionUpdate: 'current_mode_update',
        currentModeId: input.modeId,
      },
    });
    return Promise.resolve();
  }

  getSession(sessionId: string): ClineSdkRuntimeSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return session;
  }

  subscribeSession(sessionId: string, listener: SessionListener): () => void {
    const listeners = this.listenersBySession.get(sessionId) ?? new Set();
    listeners.add(listener);
    this.listenersBySession.set(sessionId, listeners);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listenersBySession.delete(sessionId);
      }
    };
  }

  async dispose(): Promise<void> {
    this.unsubscribeRepository?.();
    this.unsubscribeRepository = undefined;
    await this.repository.dispose();
    this.listenersBySession.clear();
  }

  private touchSession(sessionId: string): void {
    const session = this.getSession(sessionId);
    this.sessions.set(sessionId, {
      ...session,
      lastActivityAt: new Date().toISOString(),
    });
  }

  private publishSessionEvent(sessionId: string, event: SessionEvent): void {
    const listeners = this.listenersBySession.get(sessionId);
    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener(event);
    }
  }

  private async handleToolApproval(
    request: ToolPermissionRequest,
  ): Promise<ToolPermissionResponse> {
    if (!this.permissionHandler) {
      return {
        approved: false,
        reason: 'permission handler is not configured',
      };
    }

    return this.permissionHandler(request);
  }
}
