import type {
  AutoCheckStep,
  AutoCheckStepResult,
} from './taskAutoCheckPrimitives.js';

export type AutoCheckConfig = {
  enabled: boolean;
  steps: AutoCheckStep[];
};

export type AutoApprovalConfig = {
  enabled: boolean;
};

export type AutoCheckResult = {
  success: boolean;
  exitCode: number;
  output: string;
  command: string;
  ranAt: string;
  steps: AutoCheckStepResult[];
  failedStep?: AutoCheckStepResult;
};

export type AutoCheckRunSummary = {
  autoCheckRunId: string;
  steps: AutoCheckStep[];
};

export type AutoCheckStepEvent = {
  autoCheckRunId: string;
  stepId: string;
  name: string;
  command: string;
  phase: 'started' | 'finished';
  success?: boolean;
  exitCode?: number;
  output?: string;
  ranAt?: string;
};

export type AutoCheckFeedbackEvent = {
  autoCheckRunId: string;
  stepId: string;
  name: string;
  command: string;
  exitCode: number;
  output: string;
  prompt: string;
};
