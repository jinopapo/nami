/* eslint-disable max-lines */
import { chatRepository } from '../repository/chatRepository';
import type {
  DisplayItem,
  PendingUserAction,
  SessionEvent,
  SessionStatus,
} from '../model/chat';
import type { UiTask } from '../model/task';

const CHAT_STATUS_LABEL = {
  idle: '入力待ち',
  error: 'エラー',
  aborted: '停止中',
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
type ToolCallDisplaySource = Pick<
  ToolCallEvent,
  'toolKind' | 'title' | 'rawInput' | 'rawOutput'
>;
type ToolCallDisplay = Extract<DisplayItem, { type: 'toolCall' }>['display'];

const isToolPayloadRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getToolPayloadString = (
  payload: ToolCallEvent['rawInput'] | ToolCallEvent['rawOutput'],
  key: string,
): string | undefined => {
  if (!isToolPayloadRecord(payload)) {
    return undefined;
  }

  return typeof payload[key] === 'string' ? payload[key] : undefined;
};

const getToolEventPayloadString = (
  event: ToolCallDisplaySource,
  key: string,
): string | undefined =>
  getToolPayloadString(event.rawInput, key) ??
  getToolPayloadString(event.rawOutput, key);

const getToolPath = (event: ToolCallDisplaySource): string | undefined =>
  getToolEventPayloadString(event, 'path');

const parseToolQueryPath = (query: string): string => {
  const [path] = query.split(/:\d+(?:-\d+)?$/);
  return path;
};

const getToolArrayItemPath = (item: unknown): string | undefined => {
  if (typeof item === 'string') {
    return item;
  }

  if (!isToolPayloadRecord(item)) {
    return undefined;
  }

  return (
    (typeof item.path === 'string' ? item.path : undefined) ??
    (typeof item.filePath === 'string' ? item.filePath : undefined) ??
    (typeof item.relativePath === 'string' ? item.relativePath : undefined) ??
    (typeof item.query === 'string'
      ? parseToolQueryPath(item.query)
      : undefined)
  );
};

const getToolArrayItemQuery = (item: unknown): string | undefined => {
  if (typeof item === 'string') {
    return item;
  }

  if (!isToolPayloadRecord(item)) {
    return undefined;
  }

  return typeof item.query === 'string' ? item.query : undefined;
};

const getToolPayloadArray = (
  payload: ToolCallEvent['rawInput'] | ToolCallEvent['rawOutput'],
  key?: string,
): unknown[] | undefined => {
  if (!key) {
    return Array.isArray(payload) ? payload : undefined;
  }

  if (!isToolPayloadRecord(payload)) {
    return undefined;
  }

  const value = payload[key];
  return Array.isArray(value) ? value : undefined;
};

const getToolArrayPaths = (
  payload: ToolCallEvent['rawInput'] | ToolCallEvent['rawOutput'],
  key?: string,
): string[] | undefined => {
  const values = getToolPayloadArray(payload, key);
  if (!values) {
    return undefined;
  }

  const paths = values
    .map(getToolArrayItemPath)
    .filter((value): value is string => Boolean(value));

  return paths.length > 0 ? paths : undefined;
};

const getToolEventArrayPaths = (
  event: ToolCallDisplaySource,
  key?: string,
): string[] | undefined =>
  getToolArrayPaths(event.rawInput, key) ??
  getToolArrayPaths(event.rawOutput, key);

const getToolArrayQueries = (
  payload: ToolCallEvent['rawInput'] | ToolCallEvent['rawOutput'],
  key?: string,
): string[] | undefined => {
  const values = getToolPayloadArray(payload, key);
  if (!values) {
    return undefined;
  }

  const queries = values
    .map(getToolArrayItemQuery)
    .filter((value): value is string => Boolean(value));

  return queries.length > 0 ? queries : undefined;
};

const getToolEventArrayQueries = (
  event: ToolCallDisplaySource,
  key?: string,
): string[] | undefined =>
  getToolArrayQueries(event.rawInput, key) ??
  getToolArrayQueries(event.rawOutput, key);

const getToolArrayStrings = (
  payload: ToolCallEvent['rawInput'] | ToolCallEvent['rawOutput'],
  key?: string,
): string[] | undefined => {
  const values = getToolPayloadArray(payload, key);
  if (!values) {
    return undefined;
  }

  const strings = values.filter(
    (value): value is string => typeof value === 'string',
  );

  return strings.length > 0 ? strings : undefined;
};

const getToolEventArrayStrings = (
  event: ToolCallDisplaySource,
  key?: string,
): string[] | undefined =>
  getToolArrayStrings(event.rawInput, key) ??
  getToolArrayStrings(event.rawOutput, key);

const getReadFilesPaths = (
  event: ToolCallDisplaySource,
): string[] | undefined => {
  return (
    getToolEventArrayPaths(event, 'files') ?? getToolEventArrayPaths(event)
  );
};

const getSearchCodebaseQueries = (
  event: ToolCallDisplaySource,
): string[] | undefined =>
  getToolEventArrayQueries(event, 'queries') ?? getToolEventArrayQueries(event);

const getRunCommands = (event: ToolCallDisplaySource): string[] | undefined =>
  getToolEventArrayStrings(event, 'commands') ??
  getToolEventArrayQueries(event);

const createDefaultToolCallDisplay = (): ToolCallDisplay => ({
  variant: 'default',
  showDetails: true,
});

const createReadFilesToolCallDisplay = (
  event: ToolCallDisplaySource,
): ToolCallDisplay => {
  const requestedPaths = getReadFilesPaths(event);

  return {
    variant: 'read',
    path: requestedPaths?.[0],
    message: requestedPaths
      ? requestedPaths.map((path) => `${path}を読み込み中です`).join('\n')
      : '読み込み対象を特定中',
  };
};

const createSearchCodebaseToolCallDisplay = (
  event: ToolCallDisplaySource,
): ToolCallDisplay => {
  const queries = getSearchCodebaseQueries(event);

  return {
    variant: 'read',
    path: undefined,
    message: queries
      ? queries.map((query) => `${query}を検索中です`).join('\n')
      : '検索中',
  };
};

const createRunCommandsToolCallDisplay = (
  event: ToolCallDisplaySource,
): ToolCallDisplay => {
  const commands = getRunCommands(event);

  return {
    variant: 'read',
    path: undefined,
    message: commands
      ? commands.map((command) => `${command}実行中です`).join('\n')
      : 'コマンドを実行中です',
  };
};

const isEditorCreateOperation = (event: ToolCallDisplaySource): boolean => {
  if (isToolPayloadRecord(event.rawInput)) {
    const hasPath = typeof event.rawInput.path === 'string';
    const hasNewText = typeof event.rawInput.new_text === 'string';
    const hasOldText = typeof event.rawInput.old_text === 'string';
    const hasInsertLine = typeof event.rawInput.insert_line === 'number';

    if (hasPath && hasNewText && !hasOldText && !hasInsertLine) {
      return true;
    }
  }

  const result = getToolPayloadString(event.rawOutput, 'result');
  return (
    typeof result === 'string' &&
    result.startsWith('File created successfully at:')
  );
};

const createToolCallDisplay = (
  event: ToolCallDisplaySource,
): ToolCallDisplay => {
  const path = getToolPath(event);

  switch (event.title) {
    case 'read_files':
      return createReadFilesToolCallDisplay(event);
    case 'search_codebase':
      return createSearchCodebaseToolCallDisplay(event);
    case 'run_commands':
      return createRunCommandsToolCallDisplay(event);
    case 'editor':
      return {
        variant: 'read',
        path,
        message: isEditorCreateOperation(event)
          ? path
            ? `${path}を新規作成中です`
            : 'ファイルを新規作成中です'
          : path
            ? `${path}を編集中です`
            : 'ファイルを編集中です',
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

  if (item.type === 'error') {
    return [item.type, item.id, item.timestamp, item.message].join(':');
  }

  return [item.type, item.id, item.timestamp].join(':');
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
      if (existingIndex >= 0) {
        const existingItem = items[existingIndex];
        if (existingItem.type === 'toolCall') {
          const mergedRawInput = next.rawInput ?? existingItem.rawInput;
          const mergedRawOutput = next.rawOutput ?? existingItem.rawOutput;
          const mergedDisplaySource: ToolCallDisplaySource = {
            toolKind: next.toolKind,
            title: next.title,
            rawInput: mergedRawInput,
            rawOutput: mergedRawOutput,
          };

          items[existingIndex] = {
            ...existingItem,
            ...next,
            rawInput: mergedRawInput,
            rawOutput: mergedRawOutput,
            content: next.content ?? existingItem.content,
            locations: next.locations ?? existingItem.locations,
            details: next.details ?? existingItem.details,
            display: createToolCallDisplay(mergedDisplaySource),
          };
        }
      } else items.push(next);
      return items;
    }

    if (event.type === 'progress') {
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

    if (task.runtimeState === 'aborted') {
      return {
        phase: 'aborted',
        label: CHAT_STATUS_LABEL.aborted,
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
