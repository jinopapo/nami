import type { UiTask } from '../model/chat';

const shouldShowInlineDecisionPrompt = (task?: UiTask): boolean => task?.lifecycleState === 'awaiting_confirmation';

export const taskDecisionPromptService = {
  shouldShowInlineDecisionPrompt,
};