/* eslint-disable max-lines */
import { chatRepository } from '../repository/chatRepository';
import type {
  DisplayItem,
  PendingUserAction,
  SessionEvent,
  SessionStatus,
  ToolCallDisplay,
} from '../model/chat';
import type { UiTask } from '../model/task';

const CHAT_STATUS_LABEL = {
  idle: '入力待ち',
  error: 'エラー',
  waiting_dependencies: '依存待ち',
  before_start: '実施前',
  planning: '計画中',
  awaiting_confirmation: '確認待ち',
  executing: '実行中',
  auto_checking: '自動チェック中',
  awaiting_review: 'レビュー待ち',
  waiting_permission: 'ツール実行の許可待ち',
} as const;

type ToolCallEvent = Extract<SessionEvent, { type: 'toolCall' }>;

const getToolPayloadString = (
  payload: ToolCallEvent['rawInput'] | ToolCallEvent['rawOutput'],
  key: string,
): string | undefined => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  return typeof payload[key] === 'string' ? payload[key] : undefined;
};

const getToolEventPayloadString = (
  event: ToolCallEvent,
  key: string,
): string | undefined =>
  getToolPayloadString(event.rawInput, key) ??
  getToolPayloadString(event.rawOutput, key);

const getToolName = (event: ToolCallEvent): string | undefined =>
  getToolEventPayloadString(event, 'tool');

const createDefaultToolCallDisplay = (): ToolCallDisplay => ({
  variant: 'default',
  showDetails: true,
});

const createReadFileToolCallDisplay = (
  event: ToolCallEvent,
): ToolCallDisplay => {
  const resolvedPath = getToolPayloadString(event.rawOutput, 'path');
  const requestedPath = getToolPayloadString(event.rawInput, 'path');

  if (resolvedPath) {
    return {
      variant: 'read',
      path: resolvedPath,
      message: `${resolvedPath} 読み込み中`,
    };
  }

  return {
    variant: 'read',
    path: undefined,
    message: requestedPath
      ? `${requestedPath} 内のファイルを特定中`
      : '読み込み対象を特定中',
  };
};

const createToolCallDisplay = (event: ToolCallEvent): ToolCallDisplay => {
  const path = getToolEventPayloadString(event, 'path');
  const regex = getToolEventPayloadString(event, 'regex');

  switch (getToolName(event)) {
    case 'readFile':
      return createReadFileToolCallDisplay(event);
    case 'listFilesRecursive':
    case 'listFilesTopLevel':
      return {
        variant: 'read',
        path,
        message: path ? `${path} 読み込み中` : 'ファイル読み込み中',
      };
    case 'listCodeDefinitionNames':
      return {
        variant: 'read',
        path,
        message: path ? `${path} を分析中` : 'コード定義を分析中',
      };
    case 'searchFiles':
      return {
        variant: 'read',
        path,
        message:
          path && regex
            ? `${path}内を${regex}で検索中`
            : regex
              ? `${regex}で検索中`
              : path
                ? `${path}内を検索中`
                : '検索中',
      };
    case 'newFileCreated':
      return {
        variant: 'read',
        path,
        message: path ? `${path}を作成中` : 'ファイルを作成中',
      };
    case 'editedExistingFile':
      return {
        variant: 'read',
        path,
        message: path ? `${path}を変更中` : 'ファイルを変更中',
      };
    default:
      return createDefaultToolCallDisplay();
  }
};

const getWaitingState = (task?: UiTask) => {
  if (!task) {
    return undefined;
  }

  if (
    task.runtimeState === 'waiting_permission' ||
    task.runtimeState === 'waiting_human_decision'
  ) {
    return task.runtimeState;
  }

  return undefined;
};

const hasReadableMessage = (event: SessionEvent): boolean =>
  event.type === 'assistantMessageChunk' && event.text.length > 0;

const isPendingActionClearedAfter = (
  events: SessionEvent[],
  index: number,
): boolean => {
  const laterEvents = events.slice(index + 1);
  return laterEvents.some(
    (event) =>
      event.type === 'taskStateChanged' &&
      ['running', 'completed', 'aborted', 'error'].includes(event.state),
  );
};

const getPendingUserAction = (
  task: UiTask | undefined,
  events: SessionEvent[],
): PendingUserAction | undefined => {
  if (task?.runtimeState === 'waiting_permission') {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (
        event.type === 'permissionRequest' &&
        !isPendingActionClearedAfter(events, index)
      ) {
        return {
          type: 'permission',
          approvalId: event.approvalId,
          title: event.title,
          timestamp: event.timestamp,
        };
      }
    }
  }

  if (task?.runtimeState === 'waiting_human_decision') {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (
        event.type === 'humanDecisionRequest' &&
        !isPendingActionClearedAfter(events, index)
      ) {
        return {
          type: 'humanDecision',
          requestId: event.requestId,
          title: event.title,
          description: event.description,
          timestamp: event.timestamp,
        };
      }
    }
  }

  return undefined;
};

const hasPendingPermission = (
  task: UiTask | undefined,
  events: SessionEvent[],
): boolean => getPendingUserAction(task, events)?.type === 'permission';

const getDisplayItemAutoScrollSignature = (item?: DisplayItem): string => {
  if (!item) {
    return 'empty';
  }

  if (item.type === 'assistantMessage' || item.type === 'userMessage') {
    return [
      item.type,
      item.id,
      item.timestamp,
      item.status,
      item.text.length,
    ].join(':');
  }

  if (item.type === 'permissionRequest') {
    return [item.type, item.id, item.timestamp, item.approvalId].join(':');
  }

  if (item.type === 'humanDecisionRequest') {
    return [item.type, item.id, item.timestamp, item.requestId].join(':');
  }

  if (item.type === 'plan') {
    return [item.type, item.id, item.timestamp, item.entries.length].join(':');
  }

  if (item.type === 'toolCall') {
    return [
      item.type,
      item.id,
      item.timestamp,
      item.statusLabel,
      item.details ?? '',
    ].join(':');
  }

  if (item.type === 'taskStateChanged') {
    return [
      item.type,
      item.id,
      item.timestamp,
      item.state,
      item.reason ?? '',
    ].join(':');
  }

  if (item.type === 'autoCheckRun') {
    return [
      item.type,
      item.id,
      item.timestamp,
      item.status,
      item.success ?? '',
    ].join(':');
  }

  if (item.type === 'autoCheckStep') {
    return [
      item.type,
      item.id,
      item.timestamp,
      item.phase,
      item.success ?? '',
      item.exitCode ?? '',
      item.output?.length ?? 0,
    ].join(':');
  }

  if (item.type === 'autoCheckFeedback') {
    return [
      item.type,
      item.id,
      item.timestamp,
      item.exitCode,
      item.output.length,
    ].join(':');
  }

  return [item.type, item.id, item.timestamp, item.message].join(':');
};

const getTimelineAutoScrollState = (
  task: UiTask | undefined,
  displayItems: DisplayItem[],
) => {
  const lastItem = displayItems[displayItems.length - 1];

  return {
    shouldAutoScroll: task?.runtimeState === 'running',
    autoScrollKey: `${displayItems.length}:${getDisplayItemAutoScrollSignature(lastItem)}`,
  };
};

const toDisplayItems = (events: SessionEvent[]): DisplayItem[] =>
  events.reduce<DisplayItem[]>((items, event, index) => {
    if (event.type === 'userMessage') {
      items.push({
        type: 'userMessage',
        id: `user-message-${index}`,
        role: 'user',
        timestamp: event.timestamp,
        text: event.text,
        status: event.delivery === 'optimistic' ? 'pending' : 'sent',
      });
      return items;
    }

    if (event.type === 'assistantMessageChunk') {
      const lastItem = items[items.length - 1];
      if (
        lastItem?.type === 'assistantMessage' &&
        lastItem.status === 'streaming'
      ) {
        lastItem.text = `${lastItem.text}${event.text}`;
        lastItem.timestamp = event.timestamp;
      } else {
        items.push({
          type: 'assistantMessage',
          id: `assistant-message-${index}`,
          role: 'assistant',
          timestamp: event.timestamp,
          text: event.text,
          status: 'streaming',
        });
      }
      return items;
    }

    if (event.type === 'assistantMessageCompleted') {
      const assistantIndex = [...items]
        .map(
          (item) =>
            item.type === 'assistantMessage' && item.status === 'streaming',
        )
        .lastIndexOf(true);
      if (assistantIndex >= 0) {
        const item = items[assistantIndex];
        if (item.type === 'assistantMessage') {
          item.status = 'sent';
          item.timestamp = event.timestamp;
        }
      }
      return items;
    }

    if (event.type === 'permissionResponse' || event.type === 'abort') {
      return items;
    }

    if (event.type === 'permissionRequest') {
      items.push({
        type: 'permissionRequest',
        id: `permission-${event.approvalId}-${index}`,
        timestamp: event.timestamp,
        approvalId: event.approvalId,
        title: event.title,
      });
      return items;
    }

    if (event.type === 'humanDecisionRequest') {
      items.push({
        type: 'humanDecisionRequest',
        id: `human-decision-${event.requestId}-${index}`,
        timestamp: event.timestamp,
        requestId: event.requestId,
        title: event.title,
        description: event.description,
      });
      return items;
    }

    if (event.type === 'plan') {
      items.push({
        type: 'plan',
        id: `plan-${index}`,
        timestamp: event.timestamp,
        entries: event.entries,
      });
      return items;
    }

    if (event.type === 'toolCall') {
      const next: DisplayItem = {
        type: 'toolCall',
        id: `tool-call-${event.toolCallId ?? index}`,
        timestamp: event.timestamp,
        toolCallId: event.toolCallId,
        toolKind: event.toolKind,
        title: event.title,
        statusLabel: event.statusLabel,
        rawInput: event.rawInput,
        rawOutput: event.rawOutput,
        toolLog: event.toolLog,
        content: event.content,
        locations: event.locations,
        details: event.details,
        display: createToolCallDisplay(event),
      };
      const existingIndex = event.toolCallId
        ? items.findIndex(
            (item) =>
              item.type === 'toolCall' && item.toolCallId === event.toolCallId,
          )
        : -1;
      if (existingIndex >= 0) items[existingIndex] = next;
      else items.push(next);
      return items;
    }

    if (event.type === 'taskStateChanged') {
      items.push({
        type: 'taskStateChanged',
        id: `task-state-${index}`,
        timestamp: event.timestamp,
        state: event.state,
        reason: event.reason,
      });
      return items;
    }

    if (event.type === 'autoCheckStarted') {
      items.push({
        type: 'autoCheckRun',
        id: `auto-check-run-${event.run.autoCheckRunId}-started`,
        timestamp: event.timestamp,
        autoCheckRunId: event.run.autoCheckRunId,
        title: '自動チェックを開始しました',
        stepCount: event.run.steps.length,
        status: 'started',
      });
      return items;
    }

    if (event.type === 'autoCheckStep') {
      const next: DisplayItem = {
        type: 'autoCheckStep',
        id: `auto-check-step-${event.step.autoCheckRunId}-${event.step.stepId}`,
        timestamp: event.timestamp,
        autoCheckRunId: event.step.autoCheckRunId,
        stepId: event.step.stepId,
        name: event.step.name,
        command: event.step.command,
        phase: event.step.phase,
        success: event.step.success,
        exitCode: event.step.exitCode,
        output: event.step.output,
      };
      const existingIndex = items.findIndex(
        (item) =>
          item.type === 'autoCheckStep' &&
          item.autoCheckRunId === event.step.autoCheckRunId &&
          item.stepId === event.step.stepId,
      );
      if (existingIndex >= 0) items[existingIndex] = next;
      else items.push(next);
      return items;
    }

    if (event.type === 'autoCheckCompleted') {
      items.push({
        type: 'autoCheckRun',
        id: `auto-check-run-${event.autoCheckRunId}-completed`,
        timestamp: event.timestamp,
        autoCheckRunId: event.autoCheckRunId,
        title: event.result.success
          ? '自動チェックが完了しました'
          : '自動チェックが失敗しました',
        status: 'completed',
        success: event.result.success,
      });
      return items;
    }

    if (event.type === 'autoCheckFeedback') {
      items.push({
        type: 'autoCheckFeedback',
        id: `auto-check-feedback-${event.feedback.autoCheckRunId}-${event.feedback.stepId}`,
        timestamp: event.timestamp,
        autoCheckRunId: event.feedback.autoCheckRunId,
        stepId: event.feedback.stepId,
        name: event.feedback.name,
        command: event.feedback.command,
        exitCode: event.feedback.exitCode,
        prompt: event.feedback.prompt,
        output: event.feedback.output,
      });
      return items;
    }

    if (event.type === 'error') {
      items.push({
        type: 'error',
        id: `error-${index}`,
        timestamp: event.timestamp,
        message: event.message,
      });
    }

    return items;
  }, []);

const getSessionStatus = (
  task: UiTask | undefined,
  pendingUserAction: PendingUserAction | undefined,
  events: SessionEvent[],
): SessionStatus => {
  if (
    pendingUserAction?.type === 'permission' ||
    hasPendingPermission(task, events)
  ) {
    return {
      phase: 'waiting_permission',
      label: CHAT_STATUS_LABEL.waiting_permission,
      tone: 'waiting',
    };
  }

  if (task) {
    if (task.runtimeState === 'error') {
      return {
        phase: 'error',
        label: CHAT_STATUS_LABEL.error,
        tone: 'waiting',
      };
    }

    if (task.lifecycleState === 'before_start') {
      return {
        phase: 'before_start',
        label: CHAT_STATUS_LABEL.before_start,
        tone: 'idle',
      };
    }

    if (task.lifecycleState === 'waiting_dependencies') {
      return {
        phase: 'waiting_dependencies',
        label: CHAT_STATUS_LABEL.waiting_dependencies,
        tone: 'waiting',
      };
    }

    if (task.lifecycleState === 'planning') {
      return {
        phase: 'planning',
        label: CHAT_STATUS_LABEL.planning,
        tone: task.runtimeState === 'running' ? 'running' : 'idle',
      };
    }

    if (task.lifecycleState === 'awaiting_confirmation') {
      return {
        phase: 'awaiting_confirmation',
        label: CHAT_STATUS_LABEL.awaiting_confirmation,
        tone: 'waiting',
      };
    }

    if (task.lifecycleState === 'executing') {
      return {
        phase: 'executing',
        label: CHAT_STATUS_LABEL.executing,
        tone: task.runtimeState === 'running' ? 'running' : 'idle',
      };
    }

    if (task.lifecycleState === 'auto_checking') {
      return {
        phase: 'auto_checking',
        label: CHAT_STATUS_LABEL.auto_checking,
        tone: 'running',
      };
    }

    if (task.lifecycleState === 'awaiting_review') {
      return {
        phase: 'awaiting_review',
        label: CHAT_STATUS_LABEL.awaiting_review,
        tone: 'waiting',
      };
    }
  }

  return { phase: 'idle', label: CHAT_STATUS_LABEL.idle, tone: 'idle' };
};

// eslint-disable-next-line no-grouped-exports/no-exported-function-object -- Existing service object; clean up separately.
export const chatService = {
  sendMessage: chatRepository.sendMessage,
  abortTask: chatRepository.abortTask,
  resumeTask: chatRepository.resumeTask,
  subscribeEvents: chatRepository.subscribeEvents,
  getWaitingState,
  getPendingUserAction,
  getSessionStatus,
  getTimelineAutoScrollState,
  toDisplayItems,
  hasReadableMessage,
};
