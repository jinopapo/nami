import type {
  AutoCheckFormState,
  UiAutoCheckConfig,
  UiAutoCheckStep,
} from '../model/task';

type AutoCheckStepPatch = Partial<Pick<UiAutoCheckStep, 'name' | 'command'>>;

const createAutoCheckStep = (index: number): UiAutoCheckStep => ({
  id: `step-${crypto.randomUUID()}`,
  name: `Step ${index + 1}`,
  command: '',
});

const createAutoCheckFormState = (): AutoCheckFormState => ({
  enabled: false,
  steps: [createAutoCheckStep(0)],
  isDirty: false,
  isSaving: false,
  isRunning: false,
});

const applyAutoCheckConfig = (
  config: UiAutoCheckConfig,
  latestResult?: AutoCheckFormState['lastResult'],
): AutoCheckFormState => ({
  enabled: config.enabled,
  steps: config.steps.length > 0 ? config.steps : [createAutoCheckStep(0)],
  isDirty: false,
  isSaving: false,
  isRunning: false,
  lastResult: latestResult,
});

const setEnabled = (
  form: AutoCheckFormState,
  enabled: boolean,
): AutoCheckFormState => ({
  ...form,
  enabled,
  isDirty: true,
});

const updateStep = (
  form: AutoCheckFormState,
  stepId: string,
  patch: AutoCheckStepPatch,
): AutoCheckFormState => ({
  ...form,
  steps: form.steps.map((step) =>
    step.id === stepId ? { ...step, ...patch } : step,
  ),
  isDirty: true,
});

const addStep = (form: AutoCheckFormState): AutoCheckFormState => ({
  ...form,
  steps: [...form.steps, createAutoCheckStep(form.steps.length)],
  isDirty: true,
});

const removeStep = (
  form: AutoCheckFormState,
  stepId: string,
): AutoCheckFormState => {
  const nextSteps = form.steps.filter((step) => step.id !== stepId);

  return {
    ...form,
    steps: nextSteps.length > 0 ? nextSteps : [createAutoCheckStep(0)],
    isDirty: true,
  };
};

const toConfig = (form: AutoCheckFormState): UiAutoCheckConfig => ({
  enabled: form.enabled,
  steps: form.steps,
});

const startSaving = (form: AutoCheckFormState): AutoCheckFormState => ({
  ...form,
  isSaving: true,
});

const finishSaving = (form: AutoCheckFormState): AutoCheckFormState => ({
  ...form,
  isDirty: false,
  isSaving: false,
});

const failSaving = (form: AutoCheckFormState): AutoCheckFormState => ({
  ...form,
  isSaving: false,
});

const startRunning = (form: AutoCheckFormState): AutoCheckFormState => ({
  ...form,
  isRunning: true,
});

const finishRunning = (
  form: AutoCheckFormState,
  lastResult: AutoCheckFormState['lastResult'],
): AutoCheckFormState => ({
  ...form,
  isRunning: false,
  lastResult,
});

const failRunning = (form: AutoCheckFormState): AutoCheckFormState => ({
  ...form,
  isRunning: false,
});

export const autoCheckFormService = {
  createAutoCheckStep,
  createAutoCheckFormState,
  applyAutoCheckConfig,
  setEnabled,
  updateStep,
  addStep,
  removeStep,
  toConfig,
  startSaving,
  finishSaving,
  failSaving,
  startRunning,
  finishRunning,
  failRunning,
};
