type AutoCheckStep = {
  id: string;
  name: string;
  command: string;
};

type AutoCheckStepResult = {
  stepId: string;
  name: string;
  command: string;
  success: boolean;
  exitCode: number;
  output: string;
  ranAt: string;
};

export type AutoCheckConfig = {
  enabled: boolean;
  steps: AutoCheckStep[];
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
