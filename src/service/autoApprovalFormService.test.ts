/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_service'. Dependency is of type 'src_service' */
import { describe, expect, it } from 'vitest';
import { autoApprovalFormService } from './autoApprovalFormService';

describe('autoApprovalFormService', () => {
  it('creates disabled default form state', () => {
    const state = autoApprovalFormService.createAutoApprovalFormState();

    expect(state).toEqual({
      enabled: false,
      isDirty: false,
      isSaving: false,
    });
  });

  it('applies config without dirty state', () => {
    const state = autoApprovalFormService.applyAutoApprovalConfig({
      enabled: true,
    });

    expect(state).toEqual({
      enabled: true,
      isDirty: false,
      isSaving: false,
    });
  });

  it('updates enabled state and converts to config', () => {
    const initial = autoApprovalFormService.createAutoApprovalFormState();
    const updated = autoApprovalFormService.setEnabled(initial, true);

    expect(updated).toMatchObject({ enabled: true, isDirty: true });
    expect(autoApprovalFormService.toConfig(updated)).toEqual({
      enabled: true,
    });
  });

  it('manages save state transitions', () => {
    const dirty = autoApprovalFormService.setEnabled(
      autoApprovalFormService.createAutoApprovalFormState(),
      true,
    );
    const saving = autoApprovalFormService.startSaving(dirty);
    const saved = autoApprovalFormService.finishSaving(saving);
    const failed = autoApprovalFormService.failSaving(saving);

    expect(saving).toMatchObject({ isDirty: true, isSaving: true });
    expect(saved).toMatchObject({ isDirty: false, isSaving: false });
    expect(failed).toMatchObject({ isDirty: true, isSaving: false });
  });
});
