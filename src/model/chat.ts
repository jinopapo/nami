type UiJsonPrimitive = string | number | boolean | null;
type UiJsonArray = UiJsonValue[];

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type UiJsonValue = UiJsonPrimitive | UiJsonObject | UiJsonArray;
// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type UiJsonObject = { [key: string]: UiJsonValue | undefined };

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type ToolKind =
  | 'read'
  | 'edit'
  | 'delete'
  | 'move'
  | 'search'
  | 'execute'
  | 'think'
  | 'fetch'
  | 'switch_mode'
  | 'other';

type ToolCallPhase = 'start' | 'update' | 'complete' | 'error';
type SessionRuntimeState =
  | 'idle'
  | 'running'
  | 'waiting_permission'
  | 'waiting_human_decision'
  | 'aborted'
  | 'completed'
  | 'error';

type TaskScopedEvent = {
  taskId: string;
  timestamp: string;
  sessionId?: string;
};
type AssistantEvent = TaskScopedEvent & {
  role: 'assistant';
  delivery: 'confirmed';
  sessionId: string;
};
type UserEvent = TaskScopedEvent & {
  role: 'user';
  delivery: 'optimistic' | 'confirmed';
};
type UiPlanEntryStatus = string | undefined;
type SessionAutoCheckStep = { id: string; name: string; command: string };
type SessionAutoCheckStepResult = {
  stepId: string;
  name: string;
  command: string;
  success: boolean;
  exitCode: number;
  output: string;
  ranAt: string;
};
type SessionAutoCheckResult = {
  success: boolean;
  exitCode: number;
  output: string;
  command: string;
  ranAt: string;
  steps: SessionAutoCheckStepResult[];
  failedStep?: SessionAutoCheckStepResult;
};
type SessionAutoCheckRunSummary = {
  autoCheckRunId: string;
  steps: SessionAutoCheckStep[];
};
type SessionAutoCheckStepEvent = {
  autoCheckRunId: string;
  stepId: string;
  name: string;
  command: string;
  phase: 'started' | 'finished';
  success?: boolean;
  exitCode?: number;
  output?: string;
  ranAt?: string;
};
type SessionAutoCheckFeedbackEvent = {
  autoCheckRunId: string;
  stepId: string;
  name: string;
  command: string;
  exitCode: number;
  output: string;
  prompt: string;
};
type TimestampedDisplayItem = { id: string; timestamp: string };

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type ToolCallLog = {
  toolCallId?: string;
  toolKind: ToolKind;
  title: string;
  phase: ToolCallPhase;
  status?: string;
  statusLabel: string;
  rawInput?: UiJsonValue;
  rawOutput?: UiJsonValue;
  inputSummary?: UiJsonObject;
  outputSummary?: UiJsonObject;
  metadata?: UiJsonObject;
};

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type UiPlanEntry = { content: string; status?: UiPlanEntryStatus };

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type UiToolCallContent =
  | { type: 'content'; content: unknown }
  | { type: 'diff'; path: string; oldText?: string | null; newText: string }
  | { type: 'terminal'; terminalId: string };

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type UiToolCallLocation = {
  path?: string;
  line?: number;
  column?: number;
} & Record<string, unknown>;

type ReadToolCallDisplay = { variant: 'read'; message: string; path?: string };
// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type ToolCallDisplay =
  | ReadToolCallDisplay
  | { variant: 'default'; showDetails: boolean };

// eslint-disable-next-line no-grouped-exports/no-exported-property-type-aggregation -- Existing public type; clean up separately.
export type SessionEvent =
  | (UserEvent & { type: 'userMessage'; text: string })
  | (UserEvent & {
      type: 'permissionResponse';
      approvalId: string;
      decision: 'approve' | 'reject';
    })
  | (UserEvent & { type: 'abort' })
  | (AssistantEvent & { type: 'assistantMessageChunk'; text: string })
  | (AssistantEvent & { type: 'assistantMessageCompleted'; reason?: string })
  | (AssistantEvent & {
      type: 'permissionRequest';
      approvalId: string;
      title: string;
    })
  | (AssistantEvent & {
      type: 'humanDecisionRequest';
      requestId: string;
      title: string;
      description?: string;
      schema?: unknown;
    })
  | (AssistantEvent & { type: 'plan'; entries: UiPlanEntry[] })
  | (AssistantEvent & {
      type: 'toolCall';
      toolCallId?: string;
      toolKind: ToolKind;
      title: string;
      statusLabel: string;
      rawInput?: UiJsonValue;
      rawOutput?: UiJsonValue;
      toolLog: ToolCallLog;
      content?: UiToolCallContent[];
      locations?: UiToolCallLocation[];
      details?: string;
    })
  | (TaskScopedEvent & {
      type: 'taskStateChanged';
      role: 'assistant';
      delivery: 'confirmed' | 'optimistic';
      state: SessionRuntimeState;
      reason?: string;
    })
  | (AssistantEvent & {
      type: 'autoCheckStarted';
      run: SessionAutoCheckRunSummary;
    })
  | (AssistantEvent & {
      type: 'autoCheckStep';
      step: SessionAutoCheckStepEvent;
    })
  | (AssistantEvent & {
      type: 'autoCheckCompleted';
      autoCheckRunId: string;
      result: SessionAutoCheckResult;
    })
  | (AssistantEvent & {
      type: 'autoCheckFeedback';
      feedback: SessionAutoCheckFeedbackEvent;
    })
  | {
      type: 'error';
      role: 'assistant';
      delivery: 'confirmed';
      taskId?: string;
      sessionId?: string;
      timestamp: string;
      message: string;
    };

export type UiChatSession = {
  taskId: string;
  sessionId?: string;
  events: SessionEvent[];
};

export type DisplayItem =
  | (TimestampedDisplayItem & {
      type: 'userMessage';
      role: 'user';
      text: string;
      status: 'pending' | 'sent';
    })
  | (TimestampedDisplayItem & {
      type: 'assistantMessage';
      role: 'assistant';
      text: string;
      status: 'streaming' | 'sent' | 'error';
    })
  | (TimestampedDisplayItem & {
      type: 'permissionRequest';
      approvalId: string;
      title: string;
    })
  | (TimestampedDisplayItem & {
      type: 'humanDecisionRequest';
      requestId: string;
      title: string;
      description?: string;
    })
  | (TimestampedDisplayItem & { type: 'plan'; entries: UiPlanEntry[] })
  | (TimestampedDisplayItem & {
      type: 'toolCall';
      toolKind: ToolKind;
      toolCallId?: string;
      title: string;
      statusLabel: string;
      rawInput?: UiJsonValue;
      rawOutput?: UiJsonValue;
      toolLog: ToolCallLog;
      content?: UiToolCallContent[];
      locations?: UiToolCallLocation[];
      details?: string;
      display: ToolCallDisplay;
    })
  | (TimestampedDisplayItem & {
      type: 'taskStateChanged';
      state: SessionRuntimeState;
      reason?: string;
    })
  | (TimestampedDisplayItem & {
      type: 'autoCheckRun';
      autoCheckRunId: string;
      title: string;
      stepCount?: number;
      status: 'started' | 'completed';
      success?: boolean;
    })
  | (TimestampedDisplayItem & {
      type: 'autoCheckStep';
      autoCheckRunId: string;
      stepId: string;
      name: string;
      command: string;
      phase: 'started' | 'finished';
      success?: boolean;
      exitCode?: number;
      output?: string;
    })
  | (TimestampedDisplayItem & {
      type: 'autoCheckFeedback';
      autoCheckRunId: string;
      stepId: string;
      name: string;
      command: string;
      exitCode: number;
      prompt: string;
      output: string;
    })
  | (TimestampedDisplayItem & { type: 'error'; message: string });

export type PendingUserAction =
  | {
      type: 'permission';
      approvalId: string;
      title: string;
      timestamp: string;
    }
  | {
      type: 'humanDecision';
      requestId: string;
      title: string;
      description?: string;
      timestamp: string;
    };

export type SessionStatus = {
  phase:
    | 'idle'
    | 'error'
    | 'aborted'
    | 'initializing_workspace'
    | 'waiting_dependencies'
    | 'before_start'
    | 'planning'
    | 'awaiting_confirmation'
    | 'executing'
    | 'auto_checking'
    | 'awaiting_review'
    | 'waiting_permission';
  label: string;
  tone: 'idle' | 'running' | 'waiting';
};
