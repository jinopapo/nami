export type UiSession = {
  sessionId: string;
  title: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  live: boolean;
  archived: boolean;
};

export type UiEvent = {
  id: string;
  type: string;
  timestamp: string;
  sessionId?: string;
  [key: string]: unknown;
};
