export type UiTask = {
  taskId: string;
  sessionId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  state: UiTaskState;
};

type UiTaskState =
  | 'running'
  | 'waiting_permission'
  | 'waiting_human_decision'
  | 'aborted'
  | 'completed'
  | 'error';

export type UiPlanEntry = {
  content: string;
  status?: string;
};

type UiMessageStatus = 'pending' | 'streaming' | 'sent' | 'error';

type UiTurnState = 'submitting' | UiTaskState;

export type UiTurn = {
  turnId: string;
  taskId: string;
  sessionId?: string;
  userMessageId: string;
  assistantMessageId?: string;
  state: UiTurnState;
  startedAt: string;
  endedAt?: string;
  reason?: string;
};

export type UiChatMessage = {
  id: string;
  taskId: string;
  sessionId?: string;
  turnId?: string;
  timestamp: string;
  role: 'user' | 'assistant';
  text: string;
  status: UiMessageStatus;
};

export type UiEvent =
  | {
      type: 'message';
      taskId: string;
      sessionId: string;
      turnId?: string;
      timestamp: string;
      role: 'user' | 'assistant';
      text: string;
    }
  | {
      type: 'permissionRequest';
      taskId: string;
      sessionId: string;
      turnId: string;
      timestamp: string;
      approvalId: string;
      title: string;
    }
  | {
      type: 'humanDecisionRequest';
      taskId: string;
      sessionId: string;
      turnId: string;
      timestamp: string;
      requestId: string;
      title: string;
      description?: string;
      schema?: unknown;
    }
  | {
      type: 'assistantMessageCompleted';
      taskId: string;
      sessionId: string;
      turnId: string;
      timestamp: string;
      reason?: string;
    }
  | {
      type: 'plan';
      taskId: string;
      sessionId: string;
      turnId?: string;
      timestamp: string;
      entries: UiPlanEntry[];
    }
  | {
      type: 'toolCall';
      taskId: string;
      sessionId: string;
      turnId?: string;
      timestamp: string;
      toolCallId?: string;
      title: string;
      statusLabel: string;
      details?: string;
    }
  | {
      type: 'taskStateChanged';
      taskId: string;
      sessionId: string;
      turnId?: string;
      timestamp: string;
      state: UiTaskState;
      reason?: string;
    }
  | {
      type: 'error';
      taskId?: string;
      sessionId?: string;
      timestamp: string;
      message: string;
    };

export type UiActivity = Exclude<UiEvent, { type: 'message' | 'assistantMessageCompleted' }>;

export type UiChatSession = {
  taskId: string;
  sessionId?: string;
  messages: UiChatMessage[];
  activities: UiActivity[];
  turns: UiTurn[];
};
