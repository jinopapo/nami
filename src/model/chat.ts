export type UiTask = {
  taskId: string;
  sessionId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  state: UiTaskState;
};

export type UiTaskState =
  | 'running'
  | 'waiting_permission'
  | 'waiting_human_decision'
  | 'aborted'
  | 'completed'
  | 'error';

export type UiWaitingState = 'waiting_permission' | 'waiting_human_decision';

export type UiPlanEntry = {
  content: string;
  status?: string;
};

export type UiMessageStatus = 'pending' | 'streaming' | 'sent' | 'error';

export type UiChatMessage = {
  id: string;
  taskId: string;
  sessionId?: string;
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
      timestamp: string;
      role: 'user' | 'assistant';
      text: string;
    }
  | {
      type: 'permissionRequest';
      taskId: string;
      sessionId: string;
      timestamp: string;
      approvalId: string;
      title: string;
    }
  | {
      type: 'humanDecisionRequest';
      taskId: string;
      sessionId: string;
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
      timestamp: string;
      reason?: string;
    }
  | {
      type: 'plan';
      taskId: string;
      sessionId: string;
      timestamp: string;
      entries: UiPlanEntry[];
    }
  | {
      type: 'toolCall';
      taskId: string;
      sessionId: string;
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

export type UiChatPhase = 'idle' | 'submitting' | UiTaskState;

export type UiChatSession = {
  taskId: string;
  sessionId?: string;
  phase: UiChatPhase;
  messages: UiChatMessage[];
  activities: UiActivity[];
};
