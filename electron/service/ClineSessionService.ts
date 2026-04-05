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
import type { ChatRuntimeState } from '../../core/chat.js';
import type { TaskLifecycleState } from '../../core/task.js';
import type { TaskRecord, TaskTurnRecord } from '../entity/chat.js';
import type { PendingApproval, TaskRuntime } from '../entity/clineSession.js';
import { toolCallLogFileRepository } from '../repository/toolCallLogFileRepository.js';
import { toolCallLogRepository } from '../repository/toolCallLogRepository.js';

type ServiceEvent =
  | { type: 'task-created'; task: TaskRecord }
  | { type: 'task-lifecycle-state-changed'; taskId: string; sessionId: string; state: TaskLifecycleState; mode?: 'plan' | 'act'; reason?: string }
  | { type: 'session-update'; taskId: string; sessionId: string; turnId?: string; update: SessionUpdate }
  | { type: 'permission-request'; taskId: string; sessionId: string; turnId: string; approvalId: string; request: RequestPermissionRequest }
  | { type: 'human-decision-request'; taskId: string; sessionId: string; turnId: string; requestId: string; title: string; description?: string; schema?: unknown }
  | { type: 'assistant-message-completed'; taskId: string; sessionId: string; turnId: string; reason?: string }
  | { type: 'chat-runtime-state-changed'; taskId: string; sessionId: string; turnId?: string; state: ChatRuntimeState; reason?: string }
  | { type: 'error'; taskId?: string; sessionId?: string; message: string };

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

const PLANNING_RETRY_PROMPT = '前回の計画を踏まえて、計画を練り直してください。';
const EXECUTION_START_PROMPT = 'これまでの計画を踏まえて、actモードとして実行を開始してください。';

const isPlanningCompletionStopReason = (stopReason?: string): boolean => ['end_turn', 'completed'].includes(stopReason ?? '');
const isExecutionCompletionStopReason = (stopReason?: string): boolean => stopReason === 'end_turn';
const EXPECTED_MODE_BY_LIFECYCLE_STATE: Partial<Record<TaskLifecycleState, 'plan' | 'act'>> = {
  planning: 'plan',
  awaiting_confirmation: 'plan',
  executing: 'act',
  awaiting_review: 'act',
};

export const resolveClineDir = (): string => path.join(os.homedir(), '.cline');

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
    await this.agent.setSessionMode({ sessionId: task.sessionId, modeId: 'plan' });
    this.updateTaskMode(task.taskId, 'plan');
    const turn = this.beginTurn(task.taskId);
    this.emit({ type: 'task-created', task });
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
    this.updateRuntimeState(input.taskId, 'running', 'prompt_started', input.turnId);

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
      this.syncLifecycleAfterPrompt(input.taskId, promptResponse.stopReason);
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
    this.updateRuntimeState(taskId, 'aborted', 'cancelled');
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
      this.updateRuntimeState(input.taskId, 'running', 'permission_resolved', pending.turnId);
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
      this.updateRuntimeState(input.taskId, 'running', input.reason, pendingHumanDecision.turnId);
      return;
    }

    this.updateRuntimeState(input.taskId, 'running', input.reason, task.activeTurnId);
  }

  transitionTaskLifecycle(input: { taskId: string; nextState: TaskLifecycleState }): void {
    const task = this.requireTask(input.taskId);
    const transitions: Record<TaskLifecycleState, TaskLifecycleState[]> = {
      planning: ['awaiting_confirmation'],
      awaiting_confirmation: ['planning', 'executing'],
      executing: ['awaiting_review'],
      awaiting_review: ['completed'],
      completed: [],
    };
    const allowed = transitions[task.lifecycleState] ?? [];
    if (!allowed.includes(input.nextState)) {
      throw new Error(`Invalid lifecycle transition: ${task.lifecycleState} -> ${input.nextState}`);
    }

    if (task.lifecycleState === 'awaiting_confirmation' && input.nextState === 'planning') {
      this.restartTaskWithPrompt({
        taskId: input.taskId,
        mode: 'plan',
        lifecycleState: 'planning',
        prompt: PLANNING_RETRY_PROMPT,
        reason: 'retry_planning',
      });
      return;
    }

    if (task.lifecycleState === 'awaiting_confirmation' && input.nextState === 'executing') {
      this.restartTaskWithPrompt({
        taskId: input.taskId,
        mode: 'act',
        lifecycleState: 'executing',
        prompt: EXECUTION_START_PROMPT,
        reason: 'start_execution',
      });
      return;
    }

    this.updateLifecycleState(input.taskId, input.nextState, 'human_transition');
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
      lifecycleState: 'planning',
      runtimeState: 'running',
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

  private completeTurn(taskId: string, turnId: string, state: ChatRuntimeState, reason?: string): void {
    const task = this.requireTask(taskId);
    const turn = task.turns.find((item) => item.turnId === turnId);
    if (turn) {
      turn.state = state;
      turn.reason = reason;
      turn.endedAt = new Date().toISOString();
    }
    task.activeTurnId = undefined;
    this.updateRuntimeState(taskId, state, reason, turnId);
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

        if (name === 'current_mode_update') {
          const nextMode = (update as { currentModeId?: unknown }).currentModeId;
          if (nextMode === 'plan' || nextMode === 'act') {
            this.syncTaskModeWithLifecycle(taskId, nextMode);
          }
        }

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
        this.updateRuntimeState(taskId, 'error', error.message);
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
      this.updateRuntimeState(taskId, 'waiting_permission', 'permission_requested', turnId);
      this.emit({ type: 'permission-request', taskId, sessionId: request.sessionId, turnId, approvalId, request });
    });
  }

  private updateRuntimeState(taskId: string, state: ChatRuntimeState, reason?: string, turnId?: string): void {
    const task = this.requireTask(taskId);
    task.runtimeState = state;
    task.updatedAt = new Date().toISOString();
    if (turnId) {
      const turn = task.turns.find((item) => item.turnId === turnId);
      if (turn) {
        turn.state = state;
        turn.reason = reason;
      }
    }
    this.emit({ type: 'chat-runtime-state-changed', taskId, sessionId: task.sessionId, turnId, state, reason });
  }

  private updateTaskMode(taskId: string, mode: 'plan' | 'act'): void {
    const task = this.requireTask(taskId);
    task.mode = mode;
    task.updatedAt = new Date().toISOString();
  }

  private updateLifecycleState(taskId: string, state: TaskLifecycleState, reason?: string): void {
    const task = this.requireTask(taskId);
    task.lifecycleState = state;
    task.updatedAt = new Date().toISOString();
    const expectedMode = EXPECTED_MODE_BY_LIFECYCLE_STATE[state];
    if (expectedMode && task.mode !== expectedMode) {
      task.mode = expectedMode;
    }
    this.emit({ type: 'task-lifecycle-state-changed', taskId, sessionId: task.sessionId, state, mode: task.mode, reason });
  }

  private syncTaskModeWithLifecycle(taskId: string, mode: 'plan' | 'act'): void {
    const task = this.requireTask(taskId);
    const expectedMode = EXPECTED_MODE_BY_LIFECYCLE_STATE[task.lifecycleState];
    if (expectedMode && mode !== expectedMode) {
      void this.agent.setSessionMode({ sessionId: task.sessionId, modeId: expectedMode }).catch((error: unknown) => {
        this.emit({
          type: 'error',
          taskId,
          sessionId: task.sessionId,
          message: error instanceof Error ? error.message : 'Failed to restore expected session mode',
        });
      });
      this.updateTaskMode(taskId, expectedMode);
      return;
    }

    this.updateTaskMode(taskId, mode);
  }

  private restartTaskWithPrompt(input: {
    taskId: string;
    mode: 'plan' | 'act';
    lifecycleState: TaskLifecycleState;
    prompt: string;
    reason: string;
  }): void {
    void this.restartTaskWithPromptInternal(input);
  }

  private async restartTaskWithPromptInternal(input: {
    taskId: string;
    mode: 'plan' | 'act';
    lifecycleState: TaskLifecycleState;
    prompt: string;
    reason: string;
  }): Promise<void> {
    const task = this.requireTask(input.taskId);
    await this.agent.setSessionMode({ sessionId: task.sessionId, modeId: input.mode });
    this.updateTaskMode(input.taskId, input.mode);
    this.updateLifecycleState(input.taskId, input.lifecycleState, input.reason);
    const turn = this.beginTurn(input.taskId);
    this.runPrompt({ taskId: task.taskId, sessionId: task.sessionId, turnId: turn.turnId, prompt: input.prompt });
  }

  private syncLifecycleAfterPrompt(taskId: string, stopReason?: string): void {
    const task = this.requireTask(taskId);
    if (task.lifecycleState === 'planning' && isPlanningCompletionStopReason(stopReason)) {
      this.updateLifecycleState(taskId, 'awaiting_confirmation', stopReason ?? 'plan_turn_completed');
      return;
    }

    if (task.lifecycleState === 'executing' && isExecutionCompletionStopReason(stopReason)) {
      this.updateLifecycleState(taskId, 'awaiting_review', stopReason);
    }
  }

  private emit(event: ServiceEvent): void {
    this.events.emit('event', event);
  }

  private async logToolCallEvent(taskId: string, sessionId: string, turnId: string | undefined, update: ToolCallSessionUpdate): Promise<void> {
    const toolLog = toolCallLogRepository.createToolCallLog(update);
    const entry = {
      timestamp: new Date().toISOString(),
      taskId,
      sessionId,
      turnId,
      ...toolLog,
    };
    console.log('[tool-call-log]', entry);
    try {
      await toolCallLogFileRepository.append(this.logFilePath, entry);
    } catch (error) {
      console.error('[tool-call-log] Failed to persist tool call log', {
        logFilePath: this.logFilePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
