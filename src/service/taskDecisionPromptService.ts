import type { UiTask } from '../model/task';

const shouldShowInlineDecisionPrompt = (task?: UiTask): boolean =>
  task?.lifecycleState === 'before_start' ||
  task?.lifecycleState === 'awaiting_confirmation';

// eslint-disable-next-line no-grouped-exports/no-exported-function-object -- Existing service object; clean up separately.
export const taskDecisionPromptService = {
  shouldShowInlineDecisionPrompt,
};
