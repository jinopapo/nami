import type { UiTask } from '../model/task';
import { appRepository } from '../repository/appRepository';
import { chatRepository } from '../repository/chatRepository';
import { taskRepository } from '../repository/taskRepository';

type TransitionLifecycleInput = {
  taskId: string;
  nextState: UiTask['lifecycleState'];
  prompt?: string;
};

type SetBootError = (bootError: string | null) => void;

type SendMode = 'create' | 'revise_plan' | 'send_message';

type TaskLifecycleAction = {
  nextState: UiTask['lifecycleState'];
  key?: string;
};

type ChatPanelCommandPorts = {
  selectDirectory: (input: {
    defaultPath?: string;
  }) => Promise<{ path?: string }>;
  openWindow: () => Promise<void>;
  createTask: (input: {
    cwd?: string;
    prompt: string;
    taskBranchName?: string;
    reviewMergePolicy?: UiTask['reviewMergePolicy'];
    dependencyTaskIds?: string[];
  }) => Promise<{
    taskId: string;
    sessionId: string;
  }>;
  transitionLifecycle: (input: TransitionLifecycleInput) => Promise<void>;
  sendMessage: (input: { taskId: string; prompt: string }) => Promise<unknown>;
  resumeTask: (input: {
    taskId: string;
    reason: 'permission' | 'resume';
    payload?: { approvalId: string; decision: 'approve' | 'reject' };
  }) => Promise<void>;
  abortTask: (input: { taskId: string }) => Promise<void>;
};

const defaultPorts: ChatPanelCommandPorts = {
  selectDirectory: taskRepository.selectDirectory,
  openWindow: appRepository.openWindow,
  createTask: taskRepository.create,
  transitionLifecycle: taskRepository.transitionLifecycle,
  sendMessage: chatRepository.sendMessage,
  resumeTask: chatRepository.resumeTask,
  abortTask: chatRepository.abortTask,
};

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const createChatPanelCommandActions = <TEvent>(
  deps: {
    cwd: string;
    activeTaskCwd?: string;
    setCwd: (cwd: string) => void;
    prompt?: string;
    sendMode: SendMode;
    selectedTaskId?: string;
    activeTaskId?: string;
    taskBranchName?: string;
    reviewMergePolicy: UiTask['reviewMergePolicy'];
    dependencyTaskIds?: string[];
    beginOptimisticSession: (input: { prompt: string }) => {
      temporaryTaskId: string;
    };
    setPendingTaskCreationId: (
      value: string | null | ((current: string | null) => string | null),
    ) => void;
    openDrawer: () => void;
    promoteOptimisticSession: (
      temporaryTaskId: string,
      input: { taskId: string; sessionId: string },
    ) => void;
    selectTask: (taskId: string) => void;
    appendOptimisticUserEvent: (input: {
      taskId: string;
      prompt: string;
    }) => void;
    clearDraft: () => void;
    exitPlanRevisionMode: () => void;
    discardOptimisticSession: (temporaryTaskId: string) => void;
    createApprovalResolvedEvents: (
      approvalId: string,
      decision: 'approve' | 'reject',
    ) => TEvent[];
    appendLocalEvent: (taskId: string, event: TEvent) => void;
    createAbortEvent: () => TEvent;
    shouldEnterPlanRevisionMode: (
      nextState: UiTask['lifecycleState'],
    ) => boolean;
    enterPlanRevisionMode: () => void;
    createRetryEvent: () => TEvent;
    setBootError: SetBootError;
    onTransitionStart?: (action: TaskLifecycleAction) => void;
    onTransitionError?: (action: TaskLifecycleAction) => void;
  },
  ports: ChatPanelCommandPorts = defaultPorts,
) => {
  const handleChooseDirectory = async () => {
    try {
      const result = await ports.selectDirectory({
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

  const handleOpenWindow = async () => {
    try {
      await ports.openWindow();
      deps.setBootError(null);
    } catch (error) {
      deps.setBootError(toErrorMessage(error, 'Failed to open window.'));
    }
  };

  const handleSend = async () => {
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
        const result = await ports.createTask({
          cwd: deps.cwd,
          prompt: deps.prompt,
          taskBranchName: deps.taskBranchName,
          reviewMergePolicy: deps.reviewMergePolicy,
          dependencyTaskIds: deps.dependencyTaskIds,
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

      if (!deps.selectedTaskId) {
        return;
      }

      deps.appendOptimisticUserEvent({
        taskId: deps.selectedTaskId,
        prompt: deps.prompt,
      });
      if (deps.sendMode === 'revise_plan') {
        await ports.transitionLifecycle({
          taskId: deps.selectedTaskId,
          nextState: 'planning',
          prompt: deps.prompt,
        });
      } else {
        await ports.sendMessage({
          taskId: deps.selectedTaskId,
          prompt: deps.prompt,
        });
      }

      deps.selectTask(deps.selectedTaskId);
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

  const handleApproval = async (
    approvalId: string,
    decision: 'approve' | 'reject',
  ) => {
    if (!deps.selectedTaskId) {
      return;
    }

    const selectedTaskId = deps.selectedTaskId;

    try {
      deps
        .createApprovalResolvedEvents(approvalId, decision)
        .forEach((event) => deps.appendLocalEvent(selectedTaskId, event));
      await ports.resumeTask({
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

  const handleAbort = async () => {
    if (!deps.selectedTaskId) {
      return;
    }

    const selectedTaskId = deps.selectedTaskId;

    try {
      deps.appendLocalEvent(selectedTaskId, deps.createAbortEvent());
      await ports.abortTask({ taskId: selectedTaskId });
      deps.setBootError(null);
    } catch (error) {
      deps.setBootError(toErrorMessage(error, 'Failed to stop task.'));
    }
  };

  const handleTaskLifecycleAction = async (action: TaskLifecycleAction) => {
    if (!deps.activeTaskId) {
      return;
    }

    try {
      if (
        'key' in action &&
        ['retry-error', 'resume-aborted'].includes(action.key ?? '')
      ) {
        deps.appendLocalEvent(deps.activeTaskId, deps.createRetryEvent());
        await ports.resumeTask({
          taskId: deps.activeTaskId,
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

      deps.onTransitionStart?.(action);
      deps.exitPlanRevisionMode();
      await ports.transitionLifecycle({
        taskId: deps.activeTaskId,
        nextState: action.nextState,
      });
      deps.setBootError(null);
    } catch (error) {
      deps.onTransitionError?.(action);
      deps.setBootError(
        toErrorMessage(error, 'Failed to transition task lifecycle.'),
      );
    }
  };

  return {
    handleChooseDirectory,
    handleOpenWindow,
    handleSend,
    handleApproval,
    handleAbort,
    handleTaskLifecycleAction,
  };
};
