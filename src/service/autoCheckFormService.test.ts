/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_service'. Dependency is of type 'src_service' */
import { describe, expect, it } from 'vitest';
import { autoCheckFormService } from './autoCheckFormService';

describe('autoCheckFormService', () => {
  it('creates a default form state with one editable step', () => {
    const state = autoCheckFormService.createAutoCheckFormState();

    expect(state.enabled).toBe(false);
    expect(state.isDirty).toBe(false);
    expect(state.isSaving).toBe(false);
    expect(state.isRunning).toBe(false);
    expect(state.steps).toHaveLength(1);
    expect(state.steps[0]).toMatchObject({
      name: 'Step 1',
      command: '',
    });
  });

  it('applies config and falls back to a generated step when empty', () => {
    const configured = autoCheckFormService.applyAutoCheckConfig(
      {
        enabled: true,
        steps: [{ id: 'step-1', name: 'Lint', command: 'npm run lint' }],
      },
      undefined,
    );
    const fallback = autoCheckFormService.applyAutoCheckConfig(
      { enabled: false, steps: [] },
      undefined,
    );

    expect(configured).toMatchObject({
      enabled: true,
      steps: [{ id: 'step-1', name: 'Lint', command: 'npm run lint' }],
    });
    expect(fallback.steps).toHaveLength(1);
    expect(fallback.steps[0]).toMatchObject({
      name: 'Step 1',
      command: '',
    });
  });

  it('updates, adds, and removes steps while keeping dirty state', () => {
    const initial = autoCheckFormService.createAutoCheckFormState();
    const updated = autoCheckFormService.updateStep(
      initial,
      initial.steps[0].id,
      {
        name: 'Typecheck',
        command: 'npm run typecheck',
      },
    );
    const added = autoCheckFormService.addStep(updated);
    const removed = autoCheckFormService.removeStep(added, added.steps[0].id);

    expect(updated).toMatchObject({
      isDirty: true,
      steps: [{ name: 'Typecheck', command: 'npm run typecheck' }],
    });
    expect(added.steps).toHaveLength(2);
    expect(removed.isDirty).toBe(true);
    expect(removed.steps).toHaveLength(1);
  });

  it('manages save and run state transitions', () => {
    const initial = autoCheckFormService.createAutoCheckFormState();
    const saving = autoCheckFormService.startSaving(initial);
    const saved = autoCheckFormService.finishSaving({
      ...saving,
      isDirty: true,
    });
    const running = autoCheckFormService.startRunning(saved);
    const finished = autoCheckFormService.finishRunning(running, {
      success: true,
      exitCode: 0,
      output: 'ok',
      command: 'npm run lint',
      ranAt: '2026-03-18T00:00:00.000Z',
      steps: [],
    });

    expect(saving.isSaving).toBe(true);
    expect(saved).toMatchObject({ isSaving: false, isDirty: false });
    expect(running.isRunning).toBe(true);
    expect(finished).toMatchObject({
      isRunning: false,
      lastResult: { success: true, command: 'npm run lint' },
    });
  });
});
