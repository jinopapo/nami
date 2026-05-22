export type ClineSdkRuntimeSession = {
  sessionId: string;
  cwd: string;
  mode: 'plan' | 'act';
  createdAt: string;
  lastActivityAt: string;
};

export type ClineSdkRuntimeConfig = {
  providerId: string;
  modelId: string;
  cwd: string;
  enableTools: true;
};
