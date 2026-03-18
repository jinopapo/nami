import { EventEmitter } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  ClineAgent,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionUpdate,
} from 'cline';
import type { RuntimeSessionRecord, StoredSessionRecord } from '../entity/chat.js';
import { SessionStore } from '../repository/sessionStore.js';
import { WorkspaceDiffRepository } from '../repository/workspaceDiffRepository.js';

type ServiceEvent =
  | { type: 'raw-update'; sessionId: string; update: SessionUpdate }
  | { type: 'approval-request'; sessionId: string; approvalId: string; request: RequestPermissionRequest }
  | { type: 'approval-resolved'; sessionId: string; approvalId: string; decision: 'approve' | 'reject' }
  | { type: 'session-state'; session: StoredSessionRecord }
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
  private readonly runtimeSessions = new Map<string, RuntimeSessionRecord>();
  private readonly approvals = new Map<string, PendingApproval>();
  private readonly store: SessionStore;
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
    this.store = new SessionStore(path.join(userDataPath, 'nami-chat.json'));
    this.agent.setPermissionHandler((request) => this.handlePermissionRequest(request));
  }

  async initialize(): Promise<void> {
    await this.agent.initialize({ protocolVersion: 1, clientCapabilities: {} });
  }

  subscribe(listener: (event: ServiceEvent) => void): () => void {
    this.events.on('event', listener);
    return () => this.events.off('event', listener);
  }

  async listSessions(): Promise<StoredSessionRecord[]> {
    return this.store.listSessions();
  }

  async createSession(input: { cwd: string; title?: string }): Promise<StoredSessionRecord> {
    const response = await this.agent.newSession({ cwd: input.cwd, mcpServers: [] });
    const now = new Date().toISOString();
    const record: StoredSessionRecord = {
      sessionId: response.sessionId,
      title: input.title?.trim() || path.basename(input.cwd) || 'Untitled Session',
      cwd: input.cwd,
      createdAt: now,
      updatedAt: now,
      mode: response.modes?.currentModeId === 'act' ? 'act' : 'plan',
      live: true,
      archived: false,
      events: [],
    };

    this.runtimeSessions.set(record.sessionId, {
      ...record,
      diffSnapshot: await this.diffRepository.snapshot(record.cwd),
    });
    this.attachSessionListeners(record.sessionId);
    await this.store.saveSession(record);
    this.emit({ type: 'session-state', session: record });
    return record;
  }

  async resumeSession(sessionId: string): Promise<StoredSessionRecord> {
    const record = await this.store.getSession(sessionId);

    if (!record) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.emit({ type: 'session-state', session: record });
    return record;
  }

  async sendMessage(input: { sessionId: string; text: string }): Promise<void> {
    const runtime = this.runtimeSessions.get(input.sessionId);

    if (!runtime) {
      throw new Error('This session is archived and cannot accept new prompts.');
    }

    this.emit({ type: 'raw-update', sessionId: input.sessionId, update: { sessionUpdate: 'current_mode_update', currentModeId: runtime.mode } });
    const response = await this.agent.prompt({
      sessionId: input.sessionId,
      prompt: [{ type: 'text', text: input.text }],
    });
    runtime.updatedAt = new Date().toISOString();
    const snapshot = await this.diffRepository.snapshot(runtime.cwd);
    await this.store.saveSession({ ...runtime, events: (await this.store.getSession(input.sessionId))?.events ?? [] });
    this.emit({ type: 'prompt-finished', sessionId: input.sessionId, stopReason: response.stopReason });
    this.emit({ type: 'workspace-diff', sessionId: input.sessionId, snapshot });
    runtime.diffSnapshot = snapshot;
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

  async persistEvent(sessionId: string, event: unknown): Promise<void> {
    await this.store.appendEvent(sessionId, event);
  }

  private attachSessionListeners(sessionId: string): void {
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
