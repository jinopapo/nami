import { useEffect, useState } from 'react';
import type {
  AutoCheckFormState,
  UiAutoCheckConfig,
  UiAutoCheckStep,
  UiTask,
} from '../model/task';
import { taskRepository } from '../repository/taskRepository';

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
  latestAutoCheckResult: UiTask['latestAutoCheckResult'] | undefined,
): AutoCheckFormState => ({
  enabled: config.enabled,
  steps: config.steps.length > 0 ? config.steps : [createAutoCheckStep(0)],
  isDirty: false,
  isSaving: false,
  isRunning: false,
  lastResult: latestAutoCheckResult,
});

const toAutoCheckConfig = (form: AutoCheckFormState): UiAutoCheckConfig => ({
  enabled: form.enabled,
  steps: form.steps,
});

export const useAutoCheckFormState = (
  cwd: string,
  latestAutoCheckResult: UiTask['latestAutoCheckResult'] | undefined,
  setBootError: (bootError: string | null) => void,
) => {
  const [autoCheckForm, setAutoCheckForm] = useState(createAutoCheckFormState);

  useEffect(() => {
    if (!cwd) {
      setAutoCheckForm(createAutoCheckFormState());
      return;
    }

    let cancelled = false;
    void taskRepository
      .getAutoCheckConfig({ cwd })
      .then((config) => {
        if (cancelled) {
          return;
        }

        setAutoCheckForm(applyAutoCheckConfig(config, latestAutoCheckResult));
      })
      .catch((error) => {
        if (!cancelled) {
          setBootError(
            error instanceof Error
              ? error.message
              : 'Failed to load auto check config.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cwd, latestAutoCheckResult, setBootError]);

  const handleAutoCheckEnabledChange = (enabled: boolean) => {
    setAutoCheckForm((current) => ({ ...current, enabled, isDirty: true }));
  };

  const handleAutoCheckStepChange = (
    stepId: string,
    patch: { name?: string; command?: string },
  ) => {
    setAutoCheckForm((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.id === stepId ? { ...step, ...patch } : step,
      ),
      isDirty: true,
    }));
  };

  const handleAutoCheckAddStep = () => {
    setAutoCheckForm((current) => ({
      ...current,
      steps: [...current.steps, createAutoCheckStep(current.steps.length)],
      isDirty: true,
    }));
  };

  const handleAutoCheckRemoveStep = (stepId: string) => {
    setAutoCheckForm((current) => {
      const steps = current.steps.filter((step) => step.id !== stepId);
      return {
        ...current,
        steps: steps.length > 0 ? steps : [createAutoCheckStep(0)],
        isDirty: true,
      };
    });
  };

  const handleSaveAutoCheck = async () => {
    if (!cwd) {
      return;
    }

    try {
      setAutoCheckForm((current) => ({ ...current, isSaving: true }));
      await taskRepository.saveAutoCheckConfig({
        cwd,
        config: toAutoCheckConfig(autoCheckForm),
      });
      setAutoCheckForm((current) => ({
        ...current,
        isDirty: false,
        isSaving: false,
      }));
      setBootError(null);
    } catch (error) {
      setAutoCheckForm((current) => ({ ...current, isSaving: false }));
      setBootError(
        error instanceof Error
          ? error.message
          : 'Failed to save auto check config.',
      );
    }
  };

  const handleRunAutoCheck = async () => {
    if (!cwd) {
      return;
    }

    try {
      setAutoCheckForm((current) => ({ ...current, isRunning: true }));
      const result = await taskRepository.runAutoCheck({
        cwd,
        config: toAutoCheckConfig(autoCheckForm),
      });
      setAutoCheckForm((current) => ({
        ...current,
        isRunning: false,
        lastResult: result,
      }));
      setBootError(null);
    } catch (error) {
      setAutoCheckForm((current) => ({ ...current, isRunning: false }));
      setBootError(
        error instanceof Error ? error.message : 'Failed to run auto check.',
      );
    }
  };

  return {
    autoCheckForm,
    handleAutoCheckEnabledChange,
    handleAutoCheckStepChange,
    handleAutoCheckAddStep,
    handleAutoCheckRemoveStep,
    handleSaveAutoCheck,
    handleRunAutoCheck,
  };
};
