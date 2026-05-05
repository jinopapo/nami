import type {
  AutoApprovalFormState,
  UiAutoApprovalConfig,
} from '../model/task';

const createAutoApprovalFormState = (): AutoApprovalFormState => ({
  enabled: false,
  isDirty: false,
  isSaving: false,
});

const applyAutoApprovalConfig = (
  config: UiAutoApprovalConfig,
): AutoApprovalFormState => ({
  enabled: config.enabled,
  isDirty: false,
  isSaving: false,
});

const setEnabled = (
  form: AutoApprovalFormState,
  enabled: boolean,
): AutoApprovalFormState => ({
  ...form,
  enabled,
  isDirty: true,
});

const toConfig = (form: AutoApprovalFormState): UiAutoApprovalConfig => ({
  enabled: form.enabled,
});

const startSaving = (form: AutoApprovalFormState): AutoApprovalFormState => ({
  ...form,
  isSaving: true,
});

const finishSaving = (form: AutoApprovalFormState): AutoApprovalFormState => ({
  ...form,
  isDirty: false,
  isSaving: false,
});

const failSaving = (form: AutoApprovalFormState): AutoApprovalFormState => ({
  ...form,
  isSaving: false,
});

// eslint-disable-next-line no-grouped-exports/no-exported-function-object -- Existing service object style; clean up separately.
export const autoApprovalFormService = {
  createAutoApprovalFormState,
  applyAutoApprovalConfig,
  setEnabled,
  toConfig,
  startSaving,
  finishSaving,
  failSaving,
};
