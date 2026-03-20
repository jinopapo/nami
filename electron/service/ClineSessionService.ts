import { EventEmitter } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  ClineAgent,
  type ClineAcpSession,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionUpdate,
} from 'cline';
import type { SessionRecord } from '../entity/chat.js';
import { WorkspaceDiffRepository } from '../repository/workspaceDiffRepository.js';

type ServiceEvent =
  | { type: 'raw-update'; sessionId: string; update: SessionUpdate }
  | { type: 'approval-request'; sessionId: string; approvalId: string; request: RequestPermissionRequest }
  | { type: 'approval-resolved'; sessionId: string; approvalId: string; decision: 'approve' | 'reject' }
  | { type: 'session-state'; session: SessionRecord }
  | { type: 'prompt-finished'; sessionId: string; stopReason: string }
  | { type: 'workspace-diff'; sessionId: string; snapshot: string[] }
  | { type: 'error'; sessionId?: string; message: string };

type PendingApproval = {
  sessionId: string;
  resolve: (response: RequestPermissionResponse) => void;
};

const ACP_EVENTS = [
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

export const resolveClineDir = (): string => path.join(os.homedir(), '.cline');

export class ClineSessionService {
  private readonly agent: ClineAgent;
  private readonly events = new EventEmitter();
  private readonly diffSnapshots = new Map<string, string[]>();
  private readonly approvals = new Map<string, PendingApproval>();
  private readonly attachedSessionListeners = new Set<string>();
  private readonly diffRepository = new WorkspaceDiffRepository();

  constructor(userDataPath: string) {
    const clineDir = resolveClineDir();
    console.log('[ClineSessionService] Initializing embedded Cline', {
      clineDir,
      userDataPath,
    });
    this.agent = new ClineAgent({
      clineDir,
      debug: false,
    });
    this.agent.setPermissionHandler((request) => this.handlePermissionRequest(request));
  }

  async initialize(): Promise<void> {
    await this.agent.initialize({ protocolVersion: 1, clientCapabilities: {} });
  }

  subscribe(listener: (event: ServiceEvent) => void): () => void {
    this.events.on('event', listener);
    return () => this.events.off('event', listener);
  }

  async listSessions(): Promise<SessionRecord[]> {
    return [...this.agent.sessions.values()]
      .map((session) => this.toSessionRecord(session))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async createSession(input: { cwd: string }): Promise<SessionRecord> {
    const response = await this.agent.newSession({ cwd: input.cwd, mcpServers: [] });
    const record = await this.registerSession(response.sessionId);
    this.emit({ type: 'session-state', session: record });
    return record;
  }

  async resumeSession(sessionId: string): Promise<SessionRecord> {
    const session = this.agent.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    this.attachSessionListenersOnce(sessionId);
    const nextRecord = this.toSessionRecord(session);
    this.emit({ type: 'session-state', session: nextRecord });
    return nextRecord;
  }

  async sendMessage(input: { sessionId: string; text: string }): Promise<SessionRecord> {
    const source = this.agent.sessions.get(input.sessionId);
    if (!source) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    const response = await this.agent.newSession({ cwd: source.cwd, mcpServers: [] });
    const record = await this.registerSession(response.sessionId);

    this.emit({ type: 'session-state', session: record });
    this.emit({ type: 'raw-update', sessionId: record.sessionId, update: { sessionUpdate: 'current_mode_update', currentModeId: record.mode } });
    const promptResponse = await this.agent.prompt({
      sessionId: record.sessionId,
      prompt: [{ type: 'text', text: input.text }],
    });

    const snapshot = await this.diffRepository.snapshot(record.cwd);
    this.diffSnapshots.set(record.sessionId, snapshot);
    const updatedRecord = this.toSessionRecord(this.requireSession(record.sessionId));
    this.emit({ type: 'prompt-finished', sessionId: record.sessionId, stopReason: promptResponse.stopReason });
    this.emit({ type: 'workspace-diff', sessionId: record.sessionId, snapshot });
    return updatedRecord;
  }

  async abortTask(sessionId: string): Promise<void> {
    await this.agent.cancel({ sessionId });
  }

  respondToApproval(input: { approvalId: string; sessionId: string; decision: 'approve' | 'reject' }): void {
    const pending = this.approvals.get(input.approvalId);

    if (!pending) {
      throw new Error(`Approval not found: ${input.approvalId}`);
    }

    this.approvals.delete(input.approvalId);
    pending.resolve({
      outcome:
        input.decision === 'approve'
          ? { outcome: 'selected', optionId: 'allow_once' }
          : { outcome: 'selected', optionId: 'reject_once' },
    });
    this.emit({ type: 'approval-resolved', sessionId: input.sessionId, approvalId: input.approvalId, decision: input.decision });
  }

  private async registerSession(sessionId: string): Promise<SessionRecord> {
    const session = this.requireSession(sessionId);
    this.attachSessionListenersOnce(sessionId);
    this.diffSnapshots.set(sessionId, await this.diffRepository.snapshot(session.cwd));
    return this.toSessionRecord(session);
  }

  private requireSession(sessionId: string): ClineAcpSession {
    const session = this.agent.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  private toSessionRecord(session: ClineAcpSession): SessionRecord {
    return {
      sessionId: session.sessionId,
      cwd: session.cwd,
      createdAt: new Date(session.createdAt).toISOString(),
      updatedAt: new Date(session.lastActivityAt).toISOString(),
      mode: session.mode,
      diffSnapshot: this.diffSnapshots.get(session.sessionId) ?? [],
    };
  }

  private attachSessionListenersOnce(sessionId: string): void {
    if (this.attachedSessionListeners.has(sessionId)) {
      return;
    }

    const emitter = this.agent.emitterForSession(sessionId);

    for (const name of ACP_EVENTS) {
      emitter.on(name, (update: unknown) => {
        if (name === 'agent_thought_chunk') {
          return;
        }

        this.emit({
          type: 'raw-update',
          sessionId,
          update: { ...(update as Record<string, unknown>), sessionUpdate: name } as SessionUpdate,
        });
      });
    }

    emitter.on('error', (error) => {
      this.emit({ type: 'error', sessionId, message: error.message });
    });

    this.attachedSessionListeners.add(sessionId);
  }

  private handlePermissionRequest(request: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    return new Promise((resolve) => {
      const approvalId = randomUUID();
      this.approvals.set(approvalId, { sessionId: request.sessionId, resolve });
      this.emit({ type: 'approval-request', sessionId: request.sessionId, approvalId, request });
    });
  }

  private emit(event: ServiceEvent): void {
    this.events.emit('event', event);
  }
}
