export type AutoCheckConfig = {
  enabled: boolean;
  steps: Array<{
    id: string;
    name: string;
    command: string;
  }>;
};
