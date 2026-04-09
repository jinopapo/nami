import type { RequestPermissionRequest, SessionUpdate } from 'cline';

type ChatRuntimeState =
  | 'running'
  | 'waiting_permission'
  | 'waiting_human_decision'
  | 'aborted'
  | 'completed'
  | 'error';

type TaskLifecycleState =
  | 'planning'
  | 'awaiting_confirmation'
  | 'executing'
  | 'auto_checking'
  | 'awaiting_review'
  | 'completed';

type AutoCheckStepResult = {
  stepId: string;
  name: string;
  command: string;
  success: boolean;
  exitCode: number;
  output: string;
  ranAt: string;
};

type AutoCheckResult = {
  success: boolean;
  exitCode: number;
  output: string;
  command: string;
  ranAt: string;
  steps: AutoCheckStepResult[];
  failedStep?: AutoCheckStepResult;
};

type AutoCheckRunSummary = {
  autoCheckRunId: string;
  steps: Array<{
    id: string;
    name: string;
    command: string;
  }>;
};

type AutoCheckStepEvent = {
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

type AutoCheckFeedbackEvent = {
  autoCheckRunId: string;
  stepId: string;
  name: string;
  command: string;
  exitCode: number;
  output: string;
  prompt: string;
};

export type ServiceEvent =
  | {
      type: 'task-created';
      task: {
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
    }
  | {
      type: 'task-lifecycle-state-changed';
      taskId: string;
      sessionId: string;
      state: TaskLifecycleState;
      mode?: 'plan' | 'act';
      reason?: string;
      autoCheckResult?: AutoCheckResult;
    }
  | {
      type: 'auto-check-started';
      taskId: string;
      sessionId: string;
      run: AutoCheckRunSummary;
    }
  | {
      type: 'auto-check-step';
      taskId: string;
      sessionId: string;
      step: AutoCheckStepEvent;
    }
  | {
      type: 'auto-check-completed';
      taskId: string;
      sessionId: string;
      autoCheckRunId: string;
      result: AutoCheckResult;
    }
  | {
      type: 'auto-check-feedback-prepared';
      taskId: string;
      sessionId: string;
      feedback: AutoCheckFeedbackEvent;
    }
  | {
      type: 'session-update';
      taskId: string;
      sessionId: string;
      turnId?: string;
      update: SessionUpdate;
    }
  | {
      type: 'permission-request';
      taskId: string;
      sessionId: string;
      turnId: string;
      approvalId: string;
      request: RequestPermissionRequest;
    }
  | {
      type: 'human-decision-request';
      taskId: string;
      sessionId: string;
      turnId: string;
      requestId: string;
      title: string;
      description?: string;
      schema?: unknown;
    }
  | {
      type: 'assistant-message-completed';
      taskId: string;
      sessionId: string;
      turnId: string;
      reason?: string;
    }
  | {
      type: 'chat-runtime-state-changed';
      taskId: string;
      sessionId: string;
      turnId?: string;
      state: ChatRuntimeState;
      reason?: string;
    }
  | { type: 'error'; taskId?: string; sessionId?: string; message: string };
