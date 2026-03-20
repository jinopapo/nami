export type SessionRecord = {
  sessionId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  diffSnapshot: string[];
};
