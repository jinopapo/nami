// ts-prune-ignore-next
export const CHAT_CHANNELS = {
  createSession: 'chat:createSession',
  resumeSession: 'chat:resumeSession',
  sendMessage: 'chat:sendMessage',
  abortTask: 'chat:abortTask',
  respondToApproval: 'chat:respondToApproval',
  listSessions: 'chat:listSessions',
  selectDirectory: 'chat:selectDirectory',
  subscribeEvent: 'chat:event',
} as const;

// ts-prune-ignore-next
export type ChatPermissionDecision = 'approve' | 'reject';

export type ChatSessionSummary = {
  sessionId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
};

// ts-prune-ignore-next
export type ApprovalOption = {
  optionId: string;
  name: string;
  kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';
};

// ts-prune-ignore-next
export type ApprovalRequest = {
  approvalId: string;
  toolCallId: string;
  title: string;
  kind: string;
  status?: string;
  options: ApprovalOption[];
  resolved: boolean;
  decision?: ChatPermissionDecision;
};

// ts-prune-ignore-next
export type DiffSummaryItem = {
  path: string;
  addedLines: number;
  removedLines: number;
  summary: string;
};

// ts-prune-ignore-next
export type DiffSummary = {
  source: 'tool' | 'workspace';
  toolCallId?: string;
  items: DiffSummaryItem[];
};

// ts-prune-ignore-next
export type PlanEntry = {
  content: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
};

export type ChatEvent =
  | {
      id: string;
      type: 'message';
      sessionId: string;
      timestamp: string;
      role: 'user' | 'assistant';
      messageId?: string;
      text: string;
    }
  | {
      id: string;
      type: 'status';
      sessionId: string;
      timestamp: string;
      status: 'idle' | 'processing' | 'completed' | 'cancelled' | 'error';
      detail?: string;
      stopReason?: string;
    }
  | {
      id: string;
      type: 'tool';
      sessionId: string;
      timestamp: string;
      toolCallId: string;
      title: string;
      kind: string;
      status?: string;
      locations: string[];
      contentText?: string;
      terminalId?: string;
    }
  | {
      id: string;
      type: 'approval';
      sessionId: string;
      timestamp: string;
      approval: ApprovalRequest;
    }
  | {
      id: string;
      type: 'plan';
      sessionId: string;
      timestamp: string;
      entries: PlanEntry[];
    }
  | {
      id: string;
      type: 'diffSummary';
      sessionId: string;
      timestamp: string;
      diff: DiffSummary;
    }
  | {
      id: string;
      type: 'session';
      sessionId: string;
      timestamp: string;
      session: ChatSessionSummary;
    }
  | {
      id: string;
      type: 'error';
      sessionId?: string;
      timestamp: string;
      message: string;
    };

export type CreateSessionInput = {
  cwd?: string;
};

export type ResumeSessionInput = {
  sessionId: string;
};

export type SendMessageInput = {
  sessionId: string;
  text: string;
};

export type SendMessageResult = {
  session: ChatSessionSummary;
};

export type AbortTaskInput = {
  sessionId: string;
  taskId?: string;
};

export type RespondToApprovalInput = {
  sessionId: string;
  approvalId: string;
  decision: ChatPermissionDecision;
};

export type SelectDirectoryInput = {
  defaultPath?: string;
};

export type SelectDirectoryResult = {
  path?: string;
};
