import type { UiTask } from '../model/task';

const shouldShowInlineDecisionPrompt = (task?: UiTask): boolean =>
  task?.lifecycleState === 'before_start' ||
  task?.lifecycleState === 'awaiting_confirmation';

export const taskDecisionPromptService = {
  shouldShowInlineDecisionPrompt,
};
