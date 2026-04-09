/* eslint-disable max-lines */
import type {
  ChatRuntimeState,
  JsonObject,
  JsonValue,
  ToolCallLog as CoreToolCallLog,
} from '../../core/chat';
export type { ToolKind } from '../../core/chat';
import type { ToolKind } from '../../core/chat';
import type {
  AutoCheckConfig,
  AutoCheckFeedbackEvent,
  AutoCheckResult as CoreAutoCheckResult,
  AutoCheckRunSummary,
  AutoCheckStep,
  AutoCheckStepEvent,
  AutoCheckStepResult,
  TaskLifecycleState,
} from '../../core/task';

type UiAutoCheckStep = AutoCheckStep;
type UiAutoCheckStepResult = AutoCheckStepResult;
type AutoCheckResult = Omit<CoreAutoCheckResult, 'steps' | 'failedStep'> & {
  steps: UiAutoCheckStepResult[];
  failedStep?: UiAutoCheckStepResult;
};

export type UiJsonValue = JsonValue;
export type UiJsonObject = JsonObject;

type ToolCallPhase = CoreToolCallLog['phase'];

export type ToolCallLog = Omit<
  CoreToolCallLog,
  | 'phase'
  | 'rawInput'
  | 'rawOutput'
  | 'inputSummary'
  | 'outputSummary'
  | 'metadata'
> & {
  phase: ToolCallPhase;
  rawInput?: UiJsonValue;
  rawOutput?: UiJsonValue;
  inputSummary?: UiJsonObject;
  outputSummary?: UiJsonObject;
  metadata?: UiJsonObject;
};

export type UiTask = {
  taskId: string;
  sessionId: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
  mode: 'plan' | 'act';
  lifecycleState: TaskLifecycleState;
  runtimeState: ChatRuntimeState;
  latestAutoCheckResult?: AutoCheckResult;
};

type UiAutoCheckRunSummary = AutoCheckRunSummary;
type UiAutoCheckStepEvent = AutoCheckStepEvent;
type UiAutoCheckFeedbackEvent = AutoCheckFeedbackEvent;

export type AutoCheckFormState = Omit<AutoCheckConfig, 'steps'> & {
  steps: UiAutoCheckStep[];
  isDirty: boolean;
  isSaving: boolean;
  isRunning: boolean;
  lastResult?: AutoCheckResult;
};

export type UiPlanEntry = {
  content: string;
  status?: string;
};

export type UiToolCallContent =
  | {
      type: 'content';
      content: unknown;
    }
  | {
      type: 'diff';
      path: string;
      oldText?: string | null;
      newText: string;
    }
  | {
      type: 'terminal';
      terminalId: string;
    };

export type UiToolCallLocation = {
  path?: string;
  line?: number;
  column?: number;
} & Record<string, unknown>;

type ReadToolCallDisplay = {
  variant: 'read';
  message: string;
  path?: string;
};

export type DefaultToolCallDisplay = {
  variant: 'default';
  showDetails: boolean;
};

export type ToolCallDisplay = ReadToolCallDisplay | DefaultToolCallDisplay;

export type SessionEvent =
  | {
      type: 'userMessage';
      role: 'user';
      delivery: 'optimistic' | 'confirmed';
      taskId: string;
      sessionId?: string;
      timestamp: string;
      text: string;
    }
  | {
      type: 'permissionResponse';
      role: 'user';
      delivery: 'optimistic' | 'confirmed';
      taskId: string;
      sessionId?: string;
      timestamp: string;
      approvalId: string;
      decision: 'approve' | 'reject';
    }
  | {
      type: 'abort';
      role: 'user';
      delivery: 'optimistic' | 'confirmed';
      taskId: string;
      sessionId?: string;
      timestamp: string;
    }
  | {
      type: 'assistantMessageChunk';
      role: 'assistant';
      delivery: 'confirmed';
      taskId: string;
      sessionId: string;
      timestamp: string;
      text: string;
    }
  | {
      type: 'assistantMessageCompleted';
      role: 'assistant';
      delivery: 'confirmed';
      taskId: string;
      sessionId: string;
      timestamp: string;
      reason?: string;
    }
  | {
      type: 'permissionRequest';
      role: 'assistant';
      delivery: 'confirmed';
      taskId: string;
      sessionId: string;
      timestamp: string;
      approvalId: string;
      title: string;
    }
  | {
      type: 'humanDecisionRequest';
      role: 'assistant';
      delivery: 'confirmed';
      taskId: string;
      sessionId: string;
      timestamp: string;
      requestId: string;
      title: string;
      description?: string;
      schema?: unknown;
    }
  | {
      type: 'plan';
      role: 'assistant';
      delivery: 'confirmed';
      taskId: string;
      sessionId: string;
      timestamp: string;
      entries: UiPlanEntry[];
    }
  | {
      type: 'toolCall';
      role: 'assistant';
      delivery: 'confirmed';
      taskId: string;
      sessionId: string;
      timestamp: string;
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
    }
  | {
      type: 'taskStateChanged';
      role: 'assistant';
      delivery: 'confirmed' | 'optimistic';
      taskId: string;
      sessionId?: string;
      timestamp: string;
      state: ChatRuntimeState;
      reason?: string;
    }
  | {
      type: 'autoCheckStarted';
      role: 'assistant';
      delivery: 'confirmed';
      taskId: string;
      sessionId: string;
      timestamp: string;
      run: UiAutoCheckRunSummary;
    }
  | {
      type: 'autoCheckStep';
      role: 'assistant';
      delivery: 'confirmed';
      taskId: string;
      sessionId: string;
      timestamp: string;
      step: UiAutoCheckStepEvent;
    }
  | {
      type: 'autoCheckCompleted';
      role: 'assistant';
      delivery: 'confirmed';
      taskId: string;
      sessionId: string;
      timestamp: string;
      autoCheckRunId: string;
      result: AutoCheckResult;
    }
  | {
      type: 'autoCheckFeedback';
      role: 'assistant';
      delivery: 'confirmed';
      taskId: string;
      sessionId: string;
      timestamp: string;
      feedback: UiAutoCheckFeedbackEvent;
    }
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
  | {
      type: 'userMessage';
      id: string;
      role: 'user';
      timestamp: string;
      text: string;
      status: 'pending' | 'sent';
    }
  | {
      type: 'assistantMessage';
      id: string;
      role: 'assistant';
      timestamp: string;
      text: string;
      status: 'streaming' | 'sent' | 'error';
    }
  | {
      type: 'permissionRequest';
      id: string;
      timestamp: string;
      approvalId: string;
      title: string;
    }
  | {
      type: 'humanDecisionRequest';
      id: string;
      timestamp: string;
      requestId: string;
      title: string;
      description?: string;
    }
  | {
      type: 'plan';
      id: string;
      timestamp: string;
      entries: UiPlanEntry[];
    }
  | {
      type: 'toolCall';
      id: string;
      timestamp: string;
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
    }
  | {
      type: 'taskStateChanged';
      id: string;
      timestamp: string;
      state: ChatRuntimeState;
      reason?: string;
    }
  | {
      type: 'autoCheckRun';
      id: string;
      timestamp: string;
      autoCheckRunId: string;
      title: string;
      stepCount?: number;
      status: 'started' | 'completed';
      success?: boolean;
    }
  | {
      type: 'autoCheckStep';
      id: string;
      timestamp: string;
      autoCheckRunId: string;
      stepId: string;
      name: string;
      command: string;
      phase: 'started' | 'finished';
      success?: boolean;
      exitCode?: number;
      output?: string;
    }
  | {
      type: 'autoCheckFeedback';
      id: string;
      timestamp: string;
      autoCheckRunId: string;
      stepId: string;
      name: string;
      command: string;
      exitCode: number;
      prompt: string;
      output: string;
    }
  | {
      type: 'error';
      id: string;
      timestamp: string;
      message: string;
    };

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
    | 'planning'
    | 'awaiting_confirmation'
    | 'executing'
    | 'auto_checking'
    | 'awaiting_review'
    | 'waiting_permission';
  label: string;
  tone: 'idle' | 'running' | 'waiting';
};
