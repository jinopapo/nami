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
