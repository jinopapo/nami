import { EventEmitter } from 'node:events';
import { appendFile, mkdir } from 'node:fs/promises';
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
import type { JsonObject, JsonValue, TaskSummary, ToolCallLog, ToolKind } from '../../core/chat.js';
import type { TaskRecord, TaskTurnRecord } from '../entity/chat.js';

type ServiceEvent =
  | { type: 'task-started'; task: TaskRecord }
  | { type: 'session-update'; taskId: string; sessionId: string; turnId?: string; update: SessionUpdate }
  | { type: 'permission-request'; taskId: string; sessionId: string; turnId: string; approvalId: string; request: RequestPermissionRequest }
  | { type: 'human-decision-request'; taskId: string; sessionId: string; turnId: string; requestId: string; title: string; description?: string; schema?: unknown }
  | { type: 'assistant-message-completed'; taskId: string; sessionId: string; turnId: string; reason?: string }
  | { type: 'task-state-changed'; taskId: string; sessionId: string; turnId?: string; state: TaskSummary['state']; reason?: string }
  | { type: 'error'; taskId?: string; sessionId?: string; message: string };

type PendingApproval = {
  taskId: string;
  sessionId: string;
  turnId: string;
  resolve: (response: RequestPermissionResponse) => void;
};

type TaskRuntime = TaskRecord & {
  activeTurnId?: string;
  turns: TaskTurnRecord[];
  pendingHumanDecision?: {
    turnId: string;
    requestId: string;
    title: string;
    description?: string;
    schema?: unknown;
    resolve: (value: unknown) => void;
  };
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

type ToolCallSessionUpdate = Extract<SessionUpdate, { sessionUpdate: 'tool_call' | 'tool_call_update' }>;

export const resolveClineDir = (): string => path.join(os.homedir(), '.cline');

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const toJsonValue = (value: unknown): JsonValue | undefined => {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => toJsonValue(item)).filter((item): item is JsonValue => item !== undefined);
    return items;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, toJsonValue(item)] as const)
      .filter(([, item]) => item !== undefined);
    return Object.fromEntries(entries);
  }
  return value === undefined ? undefined : String(value);
};

const getRecord = (value: JsonValue | undefined): JsonObject | undefined => (value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : undefined);

const getString = (record: JsonObject | undefined, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
};

const getNumber = (record: JsonObject | undefined, ...keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'number') return value;
  }
  return undefined;
};

const getArrayLength = (record: JsonObject | undefined, ...keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record?.[key];
    if (Array.isArray(value)) return value.length;
  }
  return undefined;
};

const compactObject = (value: Record<string, JsonValue | undefined>): JsonObject | undefined => {
  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const resolveToolKind = (update: ToolCallSessionUpdate): ToolKind => {
  switch (update.kind) {
    case 'read':
    case 'edit':
    case 'delete':
    case 'move':
    case 'search':
    case 'execute':
    case 'think':
    case 'fetch':
    case 'switch_mode':
      return update.kind;
    default:
      return 'other';
  }
};

const resolvePhase = (status?: string): ToolCallLog['phase'] => {
  switch (status) {
    case 'completed':
      return 'complete';
    case 'error':
    case 'failed':
    case 'cancelled':
      return 'error';
    case 'processing':
    case 'in_progress':
      return 'update';
    default:
      return status ? 'update' : 'start';
  }
};

const getStatusLabel = (status?: string): string => {
  switch (status) {
    case 'processing':
    case 'in_progress':
      return 'Processing';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'error':
    case 'failed':
      return 'Error';
    default:
      return 'Running tool';
  }
};

const createToolCallLog = (update: ToolCallSessionUpdate): ToolCallLog => {
  const rawInput = toJsonValue('rawInput' in update ? update.rawInput : undefined);
  const rawOutput = toJsonValue('rawOutput' in update ? update.rawOutput : undefined);
  const inputRecord = getRecord(rawInput);
  const outputRecord = getRecord(rawOutput);
  const toolKind = resolveToolKind(update);

  return {
    toolCallId: update.toolCallId,
    toolKind,
    title: typeof update.title === 'string' ? update.title : 'Tool call',
    phase: resolvePhase(typeof update.status === 'string' ? update.status : undefined),
    status: typeof update.status === 'string' ? update.status : undefined,
    statusLabel: getStatusLabel(typeof update.status === 'string' ? update.status : undefined),
    rawInput,
    rawOutput,
    inputSummary: compactObject({
      path: getString(inputRecord, 'path', 'filePath'),
      targetPath: getString(inputRecord, 'targetPath', 'destinationPath', 'to'),
      cwd: getString(inputRecord, 'cwd'),
      command: getString(inputRecord, 'command'),
      url: getString(inputRecord, 'url'),
      query: getString(inputRecord, 'query', 'pattern'),
      line: getNumber(inputRecord, 'line'),
      limit: getNumber(inputRecord, 'limit'),
      diffCount: getArrayLength(inputRecord, 'changes', 'diffs'),
    }),
    outputSummary: compactObject({
      path: getString(outputRecord, 'path'),
      stdoutLength: getString(outputRecord, 'stdout')?.length,
      stderrLength: getString(outputRecord, 'stderr')?.length,
      exitCode: getNumber(outputRecord, 'exitCode'),
      resultCount: getArrayLength(outputRecord, 'items', 'results', 'matches'),
    }),
    metadata: compactObject({
      sessionUpdate: update.sessionUpdate,
      hasRawInput: rawInput !== undefined,
      hasRawOutput: rawOutput !== undefined,
    }),
  };
};

export class ClineSessionService {
  private readonly agent: ClineAgent;
  private readonly events = new EventEmitter();
  private readonly approvals = new Map<string, PendingApproval>();
  private readonly attachedSessionListeners = new Set<string>();
  private readonly tasks = new Map<string, TaskRuntime>();
  private readonly taskIdsBySession = new Map<string, string>();
  private readonly logFilePath: string;

  constructor(userDataPath: string) {
    const clineDir = resolveClineDir();
    this.logFilePath = path.join(userDataPath, 'logs', 'tool-calls.jsonl');
    console.log('[ClineSessionService] Initializing embedded Cline', {
      clineDir,
      userDataPath,
      logFilePath: this.logFilePath,
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

  async startTask(input: { cwd: string; prompt: string }): Promise<TaskRuntime> {
    const response = await this.agent.newSession({ cwd: input.cwd, mcpServers: [] });
    const task = this.registerTask(response.sessionId);
    const turn = this.beginTurn(task.taskId);

    this.emit({ type: 'task-started', task });
    this.emit({
      type: 'session-update',
      taskId: task.taskId,
      sessionId: task.sessionId,
      turnId: turn.turnId,
      update: { sessionUpdate: 'current_mode_update', currentModeId: task.mode },
    });

    this.runPrompt({ taskId: task.taskId, sessionId: task.sessionId, turnId: turn.turnId, prompt: input.prompt });

    return this.requireTask(task.taskId);
  }

  async sendMessage(input: { taskId: string; prompt: string }): Promise<{ taskId: string; sessionId: string; turnId: string }> {
    const task = this.requireTask(input.taskId);
    const activeTurn = task.activeTurnId ? task.turns.find((turn) => turn.turnId === task.activeTurnId) : undefined;
    if (activeTurn && ['submitting', 'running', 'waiting_permission', 'waiting_human_decision'].includes(activeTurn.state)) {
      throw new Error('A turn is already in progress for this session.');
    }

    const turn = this.beginTurn(task.taskId);
    this.runPrompt({ taskId: task.taskId, sessionId: task.sessionId, turnId: turn.turnId, prompt: input.prompt });
    return { taskId: task.taskId, sessionId: task.sessionId, turnId: turn.turnId };
  }

  private runPrompt(input: { taskId: string; sessionId: string; turnId: string; prompt: string }): void {
    this.updateTaskState(input.taskId, 'running', 'prompt_started', input.turnId);

    void this.agent.prompt({
      sessionId: input.sessionId,
      prompt: [{ type: 'text', text: input.prompt }],
    }).then((promptResponse) => {
      this.completeTurn(input.taskId, input.turnId, promptResponse.stopReason === 'cancelled' ? 'aborted' : 'completed', promptResponse.stopReason);
      this.emit({
        type: 'assistant-message-completed',
        taskId: input.taskId,
        sessionId: input.sessionId,
        turnId: input.turnId,
        reason: promptResponse.stopReason,
      });
    }).catch((error: unknown) => {
      this.completeTurn(input.taskId, input.turnId, 'error', error instanceof Error ? error.message : 'Unknown error');
      this.emit({
        type: 'error',
        taskId: input.taskId,
        sessionId: input.sessionId,
        message: error instanceof Error ? error.message : 'Failed to execute task',
      });
    });

  }

  async abortTask(taskId: string): Promise<void> {
    const task = this.requireTask(taskId);
    await this.agent.cancel({ sessionId: task.sessionId });
    this.updateTaskState(taskId, 'aborted', 'cancelled');
  }

  resumeTask(input: { taskId: string; reason: 'permission' | 'human_decision' | 'resume'; payload?: { approvalId?: string; decision?: 'approve' | 'reject'; requestId?: string; value?: unknown } }): void {
    const task = this.requireTask(input.taskId);

    if (input.reason === 'permission') {
      const approvalId = input.payload?.approvalId;
      const decision = input.payload?.decision;

      if (!approvalId || !decision) {
        throw new Error('approvalId and decision are required for permission resumes');
      }

      const pending = this.approvals.get(approvalId);

      if (!pending) {
        throw new Error(`Approval not found: ${approvalId}`);
      }

      this.approvals.delete(approvalId);
      pending.resolve({
        outcome: {
          outcome: 'selected',
          optionId: decision === 'approve' ? 'allow_once' : 'reject_once',
        },
      });
      this.updateTaskState(input.taskId, 'running', 'permission_resolved', pending.turnId);
      return;
    }

    if (input.reason === 'human_decision') {
      const pendingHumanDecision = task.pendingHumanDecision;
      if (!pendingHumanDecision) {
        throw new Error(`Human decision not found for task: ${input.taskId}`);
      }
      if (input.payload?.requestId !== pendingHumanDecision.requestId) {
        throw new Error(`Human decision request mismatch: ${input.payload?.requestId ?? 'unknown'}`);
      }
      pendingHumanDecision.resolve(input.payload?.value);
      delete task.pendingHumanDecision;
      this.updateTaskState(input.taskId, 'running', input.reason, pendingHumanDecision.turnId);
      return;
    }

    this.updateTaskState(input.taskId, 'running', input.reason, task.activeTurnId);
  }

  private registerTask(sessionId: string): TaskRecord {
    const session = this.requireSession(sessionId);
    this.attachSessionListenersOnce(sessionId);
    const taskId = randomUUID();
    const task: TaskRuntime = {
      taskId,
      sessionId: session.sessionId,
      cwd: session.cwd,
      createdAt: new Date(session.createdAt).toISOString(),
      updatedAt: new Date(session.lastActivityAt).toISOString(),
      mode: session.mode,
      state: 'running',
      turns: [],
    };
    this.tasks.set(taskId, task);
    this.taskIdsBySession.set(sessionId, taskId);
    return task;
  }

  private requireSession(sessionId: string): ClineAcpSession {
    const session = this.agent.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  private requireTask(taskId: string): TaskRuntime {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    return task;
  }

  private beginTurn(taskId: string): TaskTurnRecord {
    const task = this.requireTask(taskId);
    const turn: TaskTurnRecord = {
      turnId: randomUUID(),
      state: 'submitting',
      startedAt: new Date().toISOString(),
    };
    task.turns.push(turn);
    task.activeTurnId = turn.turnId;
    return turn;
  }

  private completeTurn(taskId: string, turnId: string, state: TaskSummary['state'], reason?: string): void {
    const task = this.requireTask(taskId);
    const turn = task.turns.find((item) => item.turnId === turnId);
    if (turn) {
      turn.state = state;
      turn.reason = reason;
      turn.endedAt = new Date().toISOString();
    }
    task.activeTurnId = undefined;
    this.updateTaskState(taskId, state, reason, turnId);
  }

  private attachSessionListenersOnce(sessionId: string): void {
    if (this.attachedSessionListeners.has(sessionId)) {
      return;
    }

    const emitter = this.agent.emitterForSession(sessionId);

    for (const name of ACP_EVENTS) {
      emitter.on(name, (update: unknown) => {
        const taskId = this.taskIdsBySession.get(sessionId);
        if (!taskId) return;

        if (name === 'tool_call' || name === 'tool_call_update') {
          void this.logToolCallEvent(taskId, sessionId, this.tasks.get(taskId)?.activeTurnId, { ...(update as Record<string, unknown>), sessionUpdate: name } as ToolCallSessionUpdate);
        }

        this.emit({
          type: 'session-update',
          taskId,
          sessionId,
          turnId: this.tasks.get(taskId)?.activeTurnId,
          update: { ...(update as Record<string, unknown>), sessionUpdate: name } as SessionUpdate,
        });
      });
    }

    emitter.on('error', (error) => {
      const taskId = this.taskIdsBySession.get(sessionId);
      if (taskId) {
        this.updateTaskState(taskId, 'error', error.message);
      }
      this.emit({ type: 'error', taskId, sessionId, message: error.message });
    });

    this.attachedSessionListeners.add(sessionId);
  }

  private handlePermissionRequest(request: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    return new Promise((resolve) => {
      const taskId = this.taskIdsBySession.get(request.sessionId);
      if (!taskId) {
        resolve({ outcome: { outcome: 'selected', optionId: 'reject_once' } });
        return;
      }
      const task = this.requireTask(taskId);
      const turnId = task.activeTurnId;
      if (!turnId) {
        resolve({ outcome: { outcome: 'selected', optionId: 'reject_once' } });
        return;
      }
      const approvalId = randomUUID();
      this.approvals.set(approvalId, { taskId, sessionId: request.sessionId, turnId, resolve });
      this.updateTaskState(taskId, 'waiting_permission', 'permission_requested', turnId);
      this.emit({ type: 'permission-request', taskId, sessionId: request.sessionId, turnId, approvalId, request });
    });
  }

  private updateTaskState(taskId: string, state: TaskSummary['state'], reason?: string, turnId?: string): void {
    const task = this.requireTask(taskId);
    task.state = state;
    task.updatedAt = new Date().toISOString();
    if (turnId) {
      const turn = task.turns.find((item) => item.turnId === turnId);
      if (turn) {
        turn.state = state;
        turn.reason = reason;
      }
    }
    this.emit({ type: 'task-state-changed', taskId, sessionId: task.sessionId, turnId, state, reason });
  }

  private emit(event: ServiceEvent): void {
    this.events.emit('event', event);
  }

  private async logToolCallEvent(taskId: string, sessionId: string, turnId: string | undefined, update: ToolCallSessionUpdate): Promise<void> {
    const toolLog = createToolCallLog(update);
    const entry = {
      timestamp: new Date().toISOString(),
      taskId,
      sessionId,
      turnId,
      ...toolLog,
    };

    console.log('[tool-call-log]', entry);

    try {
      await mkdir(path.dirname(this.logFilePath), { recursive: true });
      await appendFile(this.logFilePath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (error) {
      console.error('[tool-call-log] Failed to persist tool call log', {
        logFilePath: this.logFilePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
