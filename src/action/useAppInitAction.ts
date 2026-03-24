import { useEffect } from 'react';
import type { SessionEvent, ToolCallLog, ToolKind, UiJsonObject, UiJsonValue, UiToolCallContent, UiToolCallLocation } from '../model/chat';
import { assistantMessageEventService } from '../service/assistantMessageEventService';
import { useChatStore } from '../store/chatStore';
import { chatService } from '../service/chatService';
import { errorEventService } from '../service/errorEventService';
import { humanDecisionEventService } from '../service/humanDecisionEventService';
import { permissionEventService } from '../service/permissionEventService';
import { planEventService } from '../service/planEventService';
import { taskStateEventService } from '../service/taskStateEventService';
import { toolCallEventService } from '../service/toolCallEventService';

type TaskEvent = Parameters<Parameters<typeof chatService.subscribeEvents>[0]>[0];

const toSessionEvent = (event: TaskEvent): SessionEvent | undefined => {
  if (event.type === 'sessionUpdate') {
    return assistantMessageEventService.toAssistantMessageChunkEvent(event)
      ?? planEventService.toPlanEvent(event)
      ?? toolCallEventService.toToolCallEvent(event);
  }

  return permissionEventService.toPermissionRequestEvent(event)
    ?? humanDecisionEventService.toHumanDecisionRequestEvent(event)
    ?? assistantMessageEventService.toAssistantMessageCompletedEvent(event)
    ?? taskStateEventService.toTaskStateChangedEvent(event)
    ?? errorEventService.toErrorEvent(event);
};

export const useAppInitAction = () => {
  const { upsertTask, updateTaskState, applyUiEvent, bootError, setBootError } = useChatStore();

  useEffect(() => {
    let active = true;

    if (!window.nami?.chat) {
      setBootError('Electron preload bridge is unavailable. Check preload loading in the main process.');
      return;
    }

    const unsubscribe = chatService.subscribeEvents((event) => {
      if (event.type === 'taskStarted') {
        upsertTask(chatService.toUiTask(event.task));
      }

      if (event.type === 'taskStateChanged') {
        updateTaskState({ taskId: event.taskId, state: event.state, updatedAt: event.timestamp });
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
      active = false;
      unsubscribe();
    };
  }, [applyUiEvent, setBootError, updateTaskState, upsertTask]);

  return { bootError };
};
