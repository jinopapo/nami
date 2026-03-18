export type StoredSessionRecord = {
  sessionId: string;
  title: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  live: boolean;
  archived: boolean;
  events: unknown[];
};

export type StoredChatState = {
  sessions: StoredSessionRecord[];
};

export type RuntimeSessionRecord = {
  sessionId: string;
  cwd: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  live: boolean;
  archived: boolean;
  diffSnapshot: string[];
};
