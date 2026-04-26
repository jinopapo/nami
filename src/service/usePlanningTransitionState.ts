import { useEffect, useMemo, useState } from 'react';
import type { UiTask } from '../model/task';

type PendingTaskLifecycleTransition = {
  taskId: string;
  nextState: UiTask['lifecycleState'];
};

type TransitionAction = {
  nextState: UiTask['lifecycleState'];
};

export const usePlanningTransitionState = (activeTask?: UiTask) => {
  const [pendingTaskLifecycleTransition, setPendingTaskLifecycleTransition] =
    useState<PendingTaskLifecycleTransition | null>(null);

  const isPlanningTransitionInitializing = useMemo(
    () =>
      pendingTaskLifecycleTransition?.nextState === 'planning' &&
      activeTask?.taskId === pendingTaskLifecycleTransition.taskId &&
      activeTask.lifecycleState === 'before_start',
    [activeTask, pendingTaskLifecycleTransition],
  );

  useEffect(() => {
    if (pendingTaskLifecycleTransition && !isPlanningTransitionInitializing) {
      setPendingTaskLifecycleTransition(null);
    }
  }, [isPlanningTransitionInitializing, pendingTaskLifecycleTransition]);

  const handlePlanningTransitionStart = (action: TransitionAction) => {
    if (
      action.nextState === 'planning' &&
      activeTask?.lifecycleState === 'before_start'
    ) {
      setPendingTaskLifecycleTransition({
        taskId: activeTask.taskId,
        nextState: action.nextState,
      });
    }
  };

  const handlePlanningTransitionError = (action: TransitionAction) => {
    if (action.nextState === 'planning') {
      setPendingTaskLifecycleTransition(null);
    }
  };

  return {
    isPlanningTransitionInitializing,
    handlePlanningTransitionStart,
    handlePlanningTransitionError,
  };
};
