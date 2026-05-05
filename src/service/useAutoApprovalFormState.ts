import { useEffect, useState } from 'react';
import type { AutoApprovalFormState, UiAutoApprovalConfig } from '../model/task';
import { taskRepository } from '../repository/taskRepository';

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

const toAutoApprovalConfig = (
  form: AutoApprovalFormState,
): UiAutoApprovalConfig => ({
  enabled: form.enabled,
});

export const useAutoApprovalFormState = (
  cwd: string,
  setBootError: (bootError: string | null) => void,
) => {
  const [autoApprovalForm, setAutoApprovalForm] =
    useState<AutoApprovalFormState>(createAutoApprovalFormState);

  useEffect(() => {
    if (!cwd) {
      setAutoApprovalForm(createAutoApprovalFormState());
      return;
    }

    let cancelled = false;
    void taskRepository
      .getAutoApprovalConfig({ cwd })
      .then((config) => {
        if (cancelled) {
          return;
        }

        setAutoApprovalForm(applyAutoApprovalConfig(config));
      })
      .catch((error) => {
        if (!cancelled) {
          setBootError(
            error instanceof Error
              ? error.message
              : 'Failed to load auto approval config.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cwd, setBootError]);

  const handleAutoApprovalEnabledChange = (enabled: boolean) => {
    setAutoApprovalForm((current) => ({ ...current, enabled, isDirty: true }));
  };

  const handleSaveAutoApproval = async () => {
    if (!cwd) {
      return;
    }

    try {
      setAutoApprovalForm((current) => ({ ...current, isSaving: true }));
      await taskRepository.saveAutoApprovalConfig({
        cwd,
        config: toAutoApprovalConfig(autoApprovalForm),
      });
      setAutoApprovalForm((current) => ({
        ...current,
        isDirty: false,
        isSaving: false,
      }));
      setBootError(null);
    } catch (error) {
      setAutoApprovalForm((current) => ({ ...current, isSaving: false }));
      setBootError(
        error instanceof Error
          ? error.message
          : 'Failed to save auto approval config.',
      );
    }
  };

  return {
    autoApprovalForm,
    handleAutoApprovalEnabledChange,
    handleSaveAutoApproval,
  };
};
