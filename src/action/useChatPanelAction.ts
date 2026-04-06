import { useEffect, useMemo, useState } from 'react';
import { taskRepository } from '../repository/taskRepository';
import { useChatStore } from '../store/chatStore';
import { getWorkspaceLabel } from '../service/workspaceService';
import { chatService } from '../service/chatService';
import { taskBoardService } from '../service/taskBoardService';
import {
  taskLifecycleService,
  type TaskLifecycleAction,
} from '../service/taskLifecycleService';
import type { AutoCheckFormState } from '../model/chat';

const createAutoCheckStep = (index: number) => ({
  id: `step-${Date.now()}-${index}`,
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

export const useChatPanelAction = () => {
  const {
    tasks,
    selectedTaskId,
    sessionsByTask,
    draft,
    cwd,
    bootError,
    setDraft,
    setCwd,
    selectTask,
    clearSelectedTask,
    setBootError,
    beginOptimisticSession,
    appendOptimisticUserEvent,
    appendLocalEvent,
    promoteOptimisticSession,
  } = useChatStore();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPlanRevisionMode, setIsPlanRevisionMode] = useState(false);
  const [autoCheckForm, setAutoCheckForm] = useState<AutoCheckFormState>(
    createAutoCheckFormState(),
  );

  const activeTask = useMemo(
    () => tasks.find((task) => task.taskId === selectedTaskId),
    [selectedTaskId, tasks],
  );

  const activeSession = useMemo(
    () => (selectedTaskId ? sessionsByTask[selectedTaskId] : undefined),
    [selectedTaskId, sessionsByTask],
  );

  const displayItems = useMemo(
    () => chatService.toDisplayItems(activeSession?.events ?? []),
    [activeSession?.events],
  );

  const waitingState = useMemo(
    () => chatService.getWaitingState(activeTask),
    [activeTask],
  );
  const pendingUserAction = useMemo(
    () =>
      chatService.getPendingUserAction(activeTask, activeSession?.events ?? []),
    [activeTask, activeSession?.events],
  );
  const displayStatus = useMemo(
    () =>
      chatService.getSessionStatus(
        activeTask,
        pendingUserAction,
        activeSession?.events ?? [],
      ),
    [activeTask, pendingUserAction, activeSession?.events],
  );

  const workspaceLabel = useMemo(
    () => getWorkspaceLabel(cwd, window.nami?.homeDir),
    [cwd],
  );
  const boardColumns = useMemo(
    () => taskBoardService.getTaskCardsByColumn(tasks, sessionsByTask),
    [tasks, sessionsByTask],
  );

  const activeTitle = useMemo(() => {
    const firstUserMessage = activeSession?.events.find(
      (event) => event.type === 'userMessage',
    );
    return firstUserMessage?.type === 'userMessage'
      ? firstUserMessage.text.slice(0, 56)
      : activeTask
        ? `Task ${activeTask.taskId.slice(0, 8)}`
        : '新しいタスク';
  }, [activeSession?.events, activeTask]);

  const taskLifecycleActions = useMemo(
    () => taskLifecycleService.getTaskLifecycleActions(activeTask),
    [activeTask],
  );

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

        setAutoCheckForm({
          enabled: config.enabled,
          steps:
            config.steps.length > 0 ? config.steps : [createAutoCheckStep(0)],
          isDirty: false,
          isSaving: false,
          isRunning: false,
          lastResult: activeTask?.latestAutoCheckResult,
        });
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
  }, [cwd, activeTask?.latestAutoCheckResult, setBootError]);

  const handleChooseDirectory = async () => {
    try {
      const result = await taskRepository.selectDirectory({
        defaultPath: cwd || activeTask?.cwd,
      });
      if (!result.path) {
        return;
      }

      setCwd(result.path);

      setBootError(null);
    } catch (error) {
      setBootError(
        error instanceof Error ? error.message : 'Failed to choose directory.',
      );
    }
  };

  const handleSend = async () => {
    if (!cwd || !draft.trim()) {
      return;
    }

    const prompt = draft.trim();

    try {
      if (!selectedTaskId) {
        const { temporaryTaskId } = beginOptimisticSession({ prompt });
        const result = await taskRepository.create({ cwd, prompt });
        promoteOptimisticSession(temporaryTaskId, {
          taskId: result.taskId,
          sessionId: result.sessionId,
        });
        selectTask(result.taskId);
        setIsDrawerOpen(true);
      } else {
        if (
          activeTask?.lifecycleState === 'awaiting_confirmation' &&
          isPlanRevisionMode
        ) {
          appendOptimisticUserEvent({ taskId: selectedTaskId, prompt });
          await taskRepository.transitionLifecycle({
            taskId: selectedTaskId,
            nextState: 'planning',
            prompt,
          });
          selectTask(selectedTaskId);
        } else {
          appendOptimisticUserEvent({ taskId: selectedTaskId, prompt });
          await chatService.sendMessage({ taskId: selectedTaskId, prompt });
          selectTask(selectedTaskId);
        }
      }
      setDraft('');
      setIsPlanRevisionMode(false);
      setBootError(null);
    } catch (error) {
      setBootError(
        error instanceof Error ? error.message : 'Failed to send message.',
      );
    }
  };

  const handleApproval = async (
    approvalId: string,
    decision: 'approve' | 'reject',
  ) => {
    if (!selectedTaskId) {
      return;
    }

    try {
      appendLocalEvent(selectedTaskId, {
        type: 'permissionResponse',
        role: 'user',
        delivery: 'optimistic',
        taskId: selectedTaskId,
        sessionId: activeSession?.sessionId,
        timestamp: new Date().toISOString(),
        approvalId,
        decision,
      });
      appendLocalEvent(selectedTaskId, {
        type: 'taskStateChanged',
        role: 'assistant',
        delivery: 'optimistic',
        taskId: selectedTaskId,
        sessionId: activeSession?.sessionId,
        timestamp: new Date().toISOString(),
        state: 'running',
        reason: 'permission_resolved',
      });
      await chatService.resumeTask({
        taskId: selectedTaskId,
        reason: 'permission',
        payload: { approvalId, decision },
      });
      setBootError(null);
    } catch (error) {
      setBootError(
        error instanceof Error
          ? error.message
          : 'Failed to respond to approval.',
      );
    }
  };

  const handleAbort = async () => {
    if (!selectedTaskId) {
      return;
    }

    try {
      appendLocalEvent(selectedTaskId, {
        type: 'abort',
        role: 'user',
        delivery: 'optimistic',
        taskId: selectedTaskId,
        sessionId: activeSession?.sessionId,
        timestamp: new Date().toISOString(),
      });
      await chatService.abortTask({ taskId: selectedTaskId });
      setBootError(null);
    } catch (error) {
      setBootError(
        error instanceof Error ? error.message : 'Failed to stop task.',
      );
    }
  };

  const handleTaskLifecycleAction = async (action: TaskLifecycleAction) => {
    if (!activeTask) {
      return;
    }

    try {
      if (
        action.nextState === 'planning' &&
        activeTask.lifecycleState === 'awaiting_confirmation'
      ) {
        setIsPlanRevisionMode(true);
        setBootError(null);
        return;
      }

      setIsPlanRevisionMode(false);
      await taskRepository.transitionLifecycle({
        taskId: activeTask.taskId,
        nextState: action.nextState,
      });
      setBootError(null);
    } catch (error) {
      setBootError(
        error instanceof Error
          ? error.message
          : 'Failed to transition task lifecycle.',
      );
    }
  };

  useEffect(() => {
    if (activeTask?.lifecycleState !== 'awaiting_confirmation') {
      setIsPlanRevisionMode(false);
    }
  }, [activeTask?.lifecycleState, activeTask?.taskId]);

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
      const nextSteps = current.steps.filter((step) => step.id !== stepId);
      return {
        ...current,
        steps: nextSteps.length > 0 ? nextSteps : [createAutoCheckStep(0)],
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
        config: {
          enabled: autoCheckForm.enabled,
          steps: autoCheckForm.steps,
        },
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
        config: {
          enabled: autoCheckForm.enabled,
          steps: autoCheckForm.steps,
        },
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

  const handleCreateTask = () => {
    clearSelectedTask();
    setDraft('');
    setIsDrawerOpen(true);
  };

  const handleOpenTask = (taskId: string) => {
    selectTask(taskId);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    clearSelectedTask();
  };

  const handleOpenSettingsModal = () => {
    if (!cwd) {
      return;
    }

    setIsSettingsModalOpen(true);
  };

  const handleCloseSettingsModal = () => {
    setIsSettingsModalOpen(false);
  };

  return {
    activeTask,
    activeSession,
    displayItems,
    waitingState,
    pendingUserAction,
    displayStatus,
    boardColumns,
    activeTitle,
    taskLifecycleActions,
    isDrawerOpen,
    isSettingsModalOpen,
    workspaceLabel,
    bootError,
    draft,
    autoCheckForm,
    isPlanRevisionMode,
    setDraft,
    handleChooseDirectory,
    handleCreateTask,
    handleOpenTask,
    handleCloseDrawer,
    handleOpenSettingsModal,
    handleCloseSettingsModal,
    handleSend,
    handleApproval,
    handleAbort,
    handleTaskLifecycleAction,
    handleAutoCheckEnabledChange,
    handleAutoCheckStepChange,
    handleAutoCheckAddStep,
    handleAutoCheckRemoveStep,
    handleSaveAutoCheck,
    handleRunAutoCheck,
  };
};
