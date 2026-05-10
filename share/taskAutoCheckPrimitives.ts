export type AutoCheckStep = {
  id: string;
  name: string;
  command: string;
};

export type AutoCheckStepResult = {
  stepId: string;
  name: string;
  command: string;
  success: boolean;
  exitCode: number;
  output: string;
  ranAt: string;
};
