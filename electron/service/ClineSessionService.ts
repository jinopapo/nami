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
  private readonly attachedSessionListeners = new Set<string>();
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
    const record = await this.createRuntimeRecord({
      sessionId: response.sessionId,
      cwd: input.cwd,
      title: input.title?.trim() || path.basename(input.cwd) || 'Untitled Session',
      mode: response.modes?.currentModeId === 'act' ? 'act' : 'plan',
    });
    this.emit({ type: 'session-state', session: record });
    return record;
  }

  async resumeSession(sessionId: string): Promise<StoredSessionRecord> {
    const record = await this.store.getSession(sessionId);

    if (!record) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!record.live) {
      throw new Error('This session is no longer active in the current app process and cannot be resumed. Send a new message to continue in a new session.');
    }

    const runtime = this.runtimeSessions.get(sessionId);
    if (runtime) {
      this.attachSessionListenersOnce(sessionId);
    }

    const nextRecord = runtime ? await this.toStoredRecord(runtime) : record;
    this.emit({ type: 'session-state', session: nextRecord });
    return nextRecord;
  }

  async sendMessage(input: { sessionId: string; text: string }): Promise<StoredSessionRecord> {
    const source = await this.store.getSession(input.sessionId);

    if (!source) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    await this.archiveSession(input.sessionId);

    const response = await this.agent.newSession({ cwd: source.cwd, mcpServers: [] });
    const runtime = await this.createRuntimeSession({
      sessionId: response.sessionId,
      parentSessionId: source.sessionId,
      cwd: source.cwd,
      title: source.title,
      mode: response.modes?.currentModeId === 'act' ? 'act' : 'plan',
    });

    this.emit({ type: 'session-state', session: await this.toStoredRecord(runtime) });
    this.emit({ type: 'raw-update', sessionId: runtime.sessionId, update: { sessionUpdate: 'current_mode_update', currentModeId: runtime.mode } });
    const promptResponse = await this.agent.prompt({
      sessionId: runtime.sessionId,
      prompt: [{ type: 'text', text: input.text }],
    });

    runtime.updatedAt = new Date().toISOString();
    const snapshot = await this.diffRepository.snapshot(runtime.cwd);
    runtime.diffSnapshot = snapshot;
    const record = await this.toStoredRecord(runtime);
    await this.store.saveSession(record);
    this.emit({ type: 'prompt-finished', sessionId: runtime.sessionId, stopReason: promptResponse.stopReason });
    this.emit({ type: 'workspace-diff', sessionId: runtime.sessionId, snapshot });
    return record;
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

  private async createRuntimeRecord(input: {
    sessionId: string;
    parentSessionId?: string;
    cwd: string;
    title: string;
    mode: 'plan' | 'act';
  }): Promise<StoredSessionRecord> {
    const runtime = await this.createRuntimeSession(input);
    return this.toStoredRecord(runtime);
  }

  private async createRuntimeSession(input: {
    sessionId: string;
    parentSessionId?: string;
    cwd: string;
    title: string;
    mode: 'plan' | 'act';
  }): Promise<RuntimeSessionRecord> {
    const now = new Date().toISOString();
    const runtime: RuntimeSessionRecord = {
      sessionId: input.sessionId,
      parentSessionId: input.parentSessionId,
      title: input.title,
      cwd: input.cwd,
      createdAt: now,
      updatedAt: now,
      mode: input.mode,
      live: true,
      archived: false,
      diffSnapshot: await this.diffRepository.snapshot(input.cwd),
    };

    this.runtimeSessions.set(runtime.sessionId, runtime);
    this.attachSessionListenersOnce(runtime.sessionId);
    await this.store.saveSession(await this.toStoredRecord(runtime));
    return runtime;
  }

  private async archiveSession(sessionId: string): Promise<void> {
    const record = await this.store.getSession(sessionId);
    if (!record || record.archived) {
      return;
    }

    const archivedAt = new Date().toISOString();
    await this.store.saveSession({
      ...record,
      live: false,
      archived: true,
      archivedAt,
      updatedAt: archivedAt,
    });

    const runtime = this.runtimeSessions.get(sessionId);
    if (runtime) {
      runtime.live = false;
      runtime.archived = true;
      runtime.archivedAt = archivedAt;
      runtime.updatedAt = archivedAt;
    }
  }

  private async toStoredRecord(runtime: RuntimeSessionRecord): Promise<StoredSessionRecord> {
    return {
      sessionId: runtime.sessionId,
      parentSessionId: runtime.parentSessionId,
      title: runtime.title,
      cwd: runtime.cwd,
      createdAt: runtime.createdAt,
      updatedAt: runtime.updatedAt,
      mode: runtime.mode,
      live: runtime.live,
      archived: runtime.archived,
      archivedAt: runtime.archivedAt,
      events: (await this.store.getSession(runtime.sessionId))?.events ?? [],
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
