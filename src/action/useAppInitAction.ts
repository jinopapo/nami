import { useEffect } from 'react';
import type { SessionEvent } from '../model/chat';
import { assistantMessageEventService } from '../service/assistantMessageEventService';
import { autoCheckEventService } from '../service/autoCheckEventService';
import { useChatStore } from '../store/chatStore';
import { chatService } from '../service/chatService';
import { taskRepository } from '../repository/taskRepository';
import { errorEventService } from '../service/errorEventService';
import { humanDecisionEventService } from '../service/humanDecisionEventService';
import { permissionEventService } from '../service/permissionEventService';
import { planEventService } from '../service/planEventService';
import { taskStateEventService } from '../service/taskStateEventService';
import { taskViewStateService } from '../service/taskViewStateService';
import { toolCallEventService } from '../service/toolCallEventService';
import { userMessageEventService } from '../service/userMessageEventService';

type ChatEvent = Parameters<
  Parameters<typeof chatService.subscribeEvents>[0]
>[0];
type TaskEvent = Parameters<
  Parameters<typeof taskRepository.subscribeEvents>[0]
>[0];

const toSessionEvent = (event: ChatEvent): SessionEvent | undefined => {
  if (event.type === 'sessionUpdate') {
    return (
      userMessageEventService.toUserMessageEvent(event) ??
      assistantMessageEventService.toAssistantMessageChunkEvent(event) ??
      planEventService.toPlanEvent(event) ??
      toolCallEventService.toToolCallEvent(event)
    );
  }

  return (
    permissionEventService.toPermissionRequestEvent(event) ??
    humanDecisionEventService.toHumanDecisionRequestEvent(event) ??
    assistantMessageEventService.toAssistantMessageCompletedEvent(event) ??
    taskStateEventService.toTaskStateChangedEvent(event) ??
    errorEventService.toErrorEvent(event)
  );
};

export const useAppInitAction = () => {
  const {
    upsertTask,
    updateTaskState,
    applyUiEvent,
    bootError,
    setBootError,
    setCwd,
  } = useChatStore();

  useEffect(() => {
    if (!window.nami?.chat || !window.nami?.task) {
      setBootError(
        'Electron preload bridge is unavailable. Check preload loading in the main process.',
      );
      return;
    }

    void taskRepository
      .getLastSelectedWorkspace()
      .then((result) => {
        if (result.path) {
          setCwd(result.path);
          setBootError(null);
        }
      })
      .catch((error) => {
        setBootError(
          error instanceof Error
            ? error.message
            : 'Failed to restore last selected workspace.',
        );
      });

    const unsubscribeTask = taskRepository.subscribeEvents(
      (event: TaskEvent) => {
        const autoCheckUiEvent = autoCheckEventService.toSessionEvent(event);
        if (
          autoCheckUiEvent &&
          'taskId' in event &&
          typeof event.taskId === 'string'
        ) {
          applyUiEvent(event.taskId, autoCheckUiEvent);
        }

        if (event.type === 'taskCreated') {
          upsertTask(taskViewStateService.toUiTask(event.task));
        }

        if (event.type === 'taskLifecycleStateChanged') {
          updateTaskState(taskViewStateService.toTaskStateUpdate(event));
        }
      },
    );

    const unsubscribeChat = chatService.subscribeEvents((event: ChatEvent) => {
      if (event.type === 'chatRuntimeStateChanged') {
        updateTaskState({
          taskId: event.taskId,
          runtimeState: event.state,
          updatedAt: event.timestamp,
        });
      }

      if ('taskId' in event && typeof event.taskId === 'string') {
        const uiEvent = toSessionEvent(event);
        if (uiEvent) {
          applyUiEvent(event.taskId, uiEvent);
        }
      }
    });

    if (useChatStore.getState().cwd) {
      setBootError(null);
    }

    return () => {
      unsubscribeTask();
      unsubscribeChat();
    };
  }, [applyUiEvent, setBootError, setCwd, updateTaskState, upsertTask]);

  return { bootError };
};
