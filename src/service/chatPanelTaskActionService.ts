import type { SessionEvent } from '../model/chat';
import type { UiTask } from '../model/task';

type ChatPanelSendMode = 'create' | 'revise_plan' | 'send_message';

const getPrompt = (draft: string): string | undefined => {
  const prompt = draft.trim();
  return prompt ? prompt : undefined;
};

const resolveSendMode = (
  selectedTaskId: string | undefined,
  activeTask: UiTask | undefined,
  isPlanRevisionMode: boolean,
): ChatPanelSendMode => {
  if (!selectedTaskId) {
    return 'create';
  }

  if (
    activeTask?.lifecycleState === 'awaiting_confirmation' &&
    isPlanRevisionMode
  ) {
    return 'revise_plan';
  }

  return 'send_message';
};

const shouldEnterPlanRevisionMode = (
  lifecycleState: UiTask['lifecycleState'],
  nextState: UiTask['lifecycleState'],
): boolean =>
  nextState === 'planning' && lifecycleState === 'awaiting_confirmation';

const createApprovalResolvedEvents = (input: {
  taskId: string;
  sessionId?: string;
  approvalId: string;
  decision: 'approve' | 'reject';
}): SessionEvent[] => {
  const timestamp = new Date().toISOString();

  return [
    {
      type: 'permissionResponse',
      role: 'user',
      delivery: 'optimistic',
      taskId: input.taskId,
      sessionId: input.sessionId,
      timestamp,
      approvalId: input.approvalId,
      decision: input.decision,
    },
    {
      type: 'taskStateChanged',
      role: 'assistant',
      delivery: 'optimistic',
      taskId: input.taskId,
      sessionId: input.sessionId,
      timestamp,
      state: 'running',
      reason: 'permission_resolved',
    },
  ];
};

const createAbortEvent = (input: {
  taskId: string;
  sessionId?: string;
}): SessionEvent => ({
  type: 'abort',
  role: 'user',
  delivery: 'optimistic',
  taskId: input.taskId,
  sessionId: input.sessionId,
  timestamp: new Date().toISOString(),
});

export const chatPanelTaskActionService = {
  getPrompt,
  resolveSendMode,
  shouldEnterPlanRevisionMode,
  createApprovalResolvedEvents,
  createAbortEvent,
};
