import type { UiTask } from '../model/task';

type LocalTask = {
  taskId: string;
};

type TransitionLifecycleInput = {
  taskId: string;
  nextState: UiTask['lifecycleState'];
  prompt?: string;
};

type SetBootError = (bootError: string | null) => void;

type SendMode = 'create' | 'revise_plan' | 'send_message';

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const createChooseDirectoryHandler =
  (deps: {
    cwd: string;
    activeTaskCwd?: string;
    selectDirectory: (input: {
      defaultPath?: string;
    }) => Promise<{ path?: string }>;
    setCwd: (cwd: string) => void;
    setBootError: SetBootError;
  }) =>
  async () => {
    try {
      const result = await deps.selectDirectory({
        defaultPath: deps.cwd || deps.activeTaskCwd,
      });
      if (!result.path) {
        return;
      }

      deps.setCwd(result.path);
      deps.setBootError(null);
    } catch (error) {
      deps.setBootError(toErrorMessage(error, 'Failed to choose directory.'));
    }
  };

export const createOpenWindowHandler =
  (deps: { openWindow: () => Promise<void>; setBootError: SetBootError }) =>
  async () => {
    try {
      await deps.openWindow();
      deps.setBootError(null);
    } catch (error) {
      deps.setBootError(toErrorMessage(error, 'Failed to open window.'));
    }
  };

export const createSendHandler =
  (deps: {
    cwd: string;
    prompt?: string;
    sendMode: SendMode;
    currentTaskId?: string;
    beginOptimisticSession: (input: { prompt: string }) => {
      temporaryTaskId: string;
    };
    setPendingTaskCreationId: (
      value: string | null | ((current: string | null) => string | null),
    ) => void;
    openDrawer: () => void;
    createTask: (input: {
      cwd?: string;
      prompt: string;
      taskBranchName?: string;
      reviewMergePolicy?: UiTask['reviewMergePolicy'];
    }) => Promise<{
      taskId: string;
      sessionId: string;
    }>;
    taskBranchName?: string;
    reviewMergePolicy: UiTask['reviewMergePolicy'];
    promoteOptimisticSession: (
      temporaryTaskId: string,
      input: { taskId: string; sessionId: string },
    ) => void;
    selectTask: (taskId: string) => void;
    appendOptimisticUserEvent: (input: {
      taskId: string;
      prompt: string;
    }) => void;
    transitionLifecycle: (input: TransitionLifecycleInput) => Promise<void>;
    sendMessage: (input: {
      taskId: string;
      prompt: string;
    }) => Promise<unknown>;
    clearDraft: () => void;
    exitPlanRevisionMode: () => void;
    setBootError: SetBootError;
    discardOptimisticSession: (temporaryTaskId: string) => void;
  }) =>
  async () => {
    if (!deps.cwd || !deps.prompt) {
      return;
    }

    let temporaryTaskId: string | undefined;

    try {
      if (deps.sendMode === 'create') {
        const optimisticSession = deps.beginOptimisticSession({
          prompt: deps.prompt,
        });
        temporaryTaskId = optimisticSession.temporaryTaskId;
        deps.setPendingTaskCreationId(temporaryTaskId);
        deps.openDrawer();
        const result = await deps.createTask({
          cwd: deps.cwd,
          prompt: deps.prompt,
          taskBranchName: deps.taskBranchName,
          reviewMergePolicy: deps.reviewMergePolicy,
        });
        deps.promoteOptimisticSession(temporaryTaskId, {
          taskId: result.taskId,
          sessionId: result.sessionId,
        });
        deps.selectTask(result.taskId);
        deps.clearDraft();
        deps.exitPlanRevisionMode();
        deps.setBootError(null);
        return;
      }

      if (!deps.currentTaskId) {
        return;
      }

      deps.appendOptimisticUserEvent({
        taskId: deps.currentTaskId,
        prompt: deps.prompt,
      });
      if (deps.sendMode === 'revise_plan') {
        await deps.transitionLifecycle({
          taskId: deps.currentTaskId,
          nextState: 'planning',
          prompt: deps.prompt,
        });
      } else {
        await deps.sendMessage({
          taskId: deps.currentTaskId,
          prompt: deps.prompt,
        });
      }

      deps.selectTask(deps.currentTaskId);
      deps.clearDraft();
      deps.exitPlanRevisionMode();
      deps.setBootError(null);
    } catch (error) {
      if (temporaryTaskId) {
        deps.discardOptimisticSession(temporaryTaskId);
      }
      deps.setBootError(toErrorMessage(error, 'Failed to send message.'));
    } finally {
      if (temporaryTaskId) {
        deps.setPendingTaskCreationId((current) =>
          current === temporaryTaskId ? null : current,
        );
      }
    }
  };

export const createApprovalHandler =
  <TEvent>(deps: {
    selectedTaskId?: string;
    createApprovalResolvedEvents: (
      approvalId: string,
      decision: 'approve' | 'reject',
    ) => TEvent[];
    appendLocalEvent: (taskId: string, event: TEvent) => void;
    resumeTask: (input: {
      taskId: string;
      reason: 'permission';
      payload: { approvalId: string; decision: 'approve' | 'reject' };
    }) => Promise<void>;
    setBootError: SetBootError;
  }) =>
  async (approvalId: string, decision: 'approve' | 'reject') => {
    if (!deps.selectedTaskId) {
      return;
    }

    const selectedTaskId = deps.selectedTaskId;

    try {
      deps
        .createApprovalResolvedEvents(approvalId, decision)
        .forEach((event) => deps.appendLocalEvent(selectedTaskId, event));
      await deps.resumeTask({
        taskId: selectedTaskId,
        reason: 'permission',
        payload: { approvalId, decision },
      });
      deps.setBootError(null);
    } catch (error) {
      deps.setBootError(
        toErrorMessage(error, 'Failed to respond to approval.'),
      );
    }
  };

export const createAbortHandler =
  <TEvent>(deps: {
    selectedTaskId?: string;
    createAbortEvent: () => TEvent;
    appendLocalEvent: (taskId: string, event: TEvent) => void;
    abortTask: (input: { taskId: string }) => Promise<void>;
    setBootError: SetBootError;
  }) =>
  async () => {
    if (!deps.selectedTaskId) {
      return;
    }

    const selectedTaskId = deps.selectedTaskId;

    try {
      deps.appendLocalEvent(selectedTaskId, deps.createAbortEvent());
      await deps.abortTask({ taskId: selectedTaskId });
      deps.setBootError(null);
    } catch (error) {
      deps.setBootError(toErrorMessage(error, 'Failed to stop task.'));
    }
  };

export const createTaskLifecycleActionHandler =
  <TEvent>(deps: {
    activeTask?: LocalTask;
    shouldEnterPlanRevisionMode: (
      nextState: UiTask['lifecycleState'],
    ) => boolean;
    enterPlanRevisionMode: () => void;
    exitPlanRevisionMode: () => void;
    transitionLifecycle: (input: TransitionLifecycleInput) => Promise<void>;
    createRetryEvent: () => TEvent;
    appendLocalEvent: (taskId: string, event: TEvent) => void;
    resumeTask: (input: { taskId: string; reason: 'resume' }) => Promise<void>;
    setBootError: SetBootError;
  }) =>
  async (action: { nextState: UiTask['lifecycleState']; key?: string }) => {
    if (!deps.activeTask) {
      return;
    }

    try {
      if ('key' in action && action.key === 'retry-error') {
        deps.appendLocalEvent(deps.activeTask.taskId, deps.createRetryEvent());
        await deps.resumeTask({
          taskId: deps.activeTask.taskId,
          reason: 'resume',
        });
        deps.setBootError(null);
        return;
      }

      if (deps.shouldEnterPlanRevisionMode(action.nextState)) {
        deps.enterPlanRevisionMode();
        deps.setBootError(null);
        return;
      }

      deps.exitPlanRevisionMode();
      await deps.transitionLifecycle({
        taskId: deps.activeTask.taskId,
        nextState: action.nextState,
      });
      deps.setBootError(null);
    } catch (error) {
      deps.setBootError(
        toErrorMessage(error, 'Failed to transition task lifecycle.'),
      );
    }
  };
