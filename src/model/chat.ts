export type UiSession = {
  sessionId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
};

export type UiEvent = {
  id: string;
  type: string;
  timestamp: string;
  sessionId: string;
  role?: 'user' | 'assistant';
  text?: string;
  messageId?: string;
  [key: string]: unknown;
};
