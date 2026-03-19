export type StoredSessionRecord = {
  sessionId: string;
  parentSessionId?: string;
  title: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  live: boolean;
  archived: boolean;
  archivedAt?: string;
  events: unknown[];
};

export type StoredChatState = {
  sessions: StoredSessionRecord[];
};

export type RuntimeSessionRecord = {
  sessionId: string;
  parentSessionId?: string;
  cwd: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  live: boolean;
  archived: boolean;
  archivedAt?: string;
  diffSnapshot: string[];
  restoredAt?: string;
};
