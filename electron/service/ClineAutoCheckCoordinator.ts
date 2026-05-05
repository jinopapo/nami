import { randomUUID } from 'node:crypto';
import type {
  AutoCheckConfig,
  AutoCheckResult,
} from '../entity/autoCheckConfig.js';
import type { TaskRuntime } from '../entity/clineSession.js';
import type { AutoCheckCoordinatorPort } from '../entity/clineSessionPromptCoordinator.js';

type HandleExecutionCompletedInput = Parameters<
  AutoCheckCoordinatorPort['handleExecutionCompleted']
>[0];
type AutoCheckStepResult = AutoCheckResult['steps'][number];
type AutoCheckProgressListener = {
  onStepStarted(input: {
    autoCheckRunId: string;
    step: AutoCheckConfig['steps'][number];
  }): void;
  onStepFinished(input: {
    autoCheckRunId: string;
    result: AutoCheckStepResult;
  }): void;
};
type TaskLifecycleState = TaskRuntime['lifecycleState'];
type AutoCheckEvent = Parameters<HandleExecutionCompletedInput['emit']>[0];
type AutoCheckFeedback = Extract<
  AutoCheckEvent,
  { type: 'auto-check-feedback-prepared' }
>['feedback'];

const AUTO_CHECK_FAILURE_PROMPT =
  '自動チェックに失敗しました。失敗したチェック結果だけを確認して修正してください。';

const buildAutoCheckFailureFeedback = (
  failedStep: AutoCheckStepResult,
): AutoCheckFeedback => {
  const prompt = `${AUTO_CHECK_FAILURE_PROMPT}\n\nstep: ${failedStep.name}\ncommand: ${failedStep.command}\nexitCode: ${failedStep.exitCode}\noutput:\n${failedStep.output || '(empty)'}`;

  return {
    autoCheckRunId: 'unknown',
    stepId: failedStep.stepId,
    name: failedStep.name,
    command: failedStep.command,
    exitCode: failedStep.exitCode,
    output: failedStep.output,
    prompt,
  };
};

type RuntimeServicePort = {
  getTask(taskId: string): TaskRuntime;
  updateLifecycleState(
    taskId: string,
    state: TaskLifecycleState,
    reason?: string,
    autoCheckResult?: AutoCheckResult,
  ): TaskRuntime;
};

type WorkspaceAutoCheckPort = {
  getConfig(cwd: string): Promise<AutoCheckConfig>;
  runWithProgress(
    cwd: string,
    config?: AutoCheckConfig,
    onProgress?: AutoCheckProgressListener,
    autoCheckRunId?: string,
  ): Promise<AutoCheckResult>;
};

export class ClineAutoCheckCoordinator {
  constructor(
    private readonly runtimeService: RuntimeServicePort,
    private readonly workspaceAutoCheckService: WorkspaceAutoCheckPort,
  ) {}

  async handleExecutionCompleted(
    input: HandleExecutionCompletedInput,
  ): Promise<void> {
    const task = this.runtimeService.getTask(input.taskId);
    const config = await this.workspaceAutoCheckService.getConfig(task.cwd);
    task.autoCheckConfig = config;

    if (!config.enabled || config.steps.length === 0) {
      const updatedTask = this.runtimeService.updateLifecycleState(
        input.taskId,
        'awaiting_review',
        input.reason,
      );
      input.emit({
        type: 'task-lifecycle-state-changed',
        taskId: updatedTask.taskId,
        sessionId: updatedTask.sessionId,
        state: 'awaiting_review',
        reason: input.reason,
        mode: updatedTask.mode,
      });
      return;
    }

    const autoCheckingTask = this.runtimeService.updateLifecycleState(
      input.taskId,
      'auto_checking',
      'auto_check_started',
    );
    input.emit({
      type: 'task-lifecycle-state-changed',
      taskId: autoCheckingTask.taskId,
      sessionId: autoCheckingTask.sessionId,
      state: 'auto_checking',
      reason: 'auto_check_started',
      mode: autoCheckingTask.mode,
    });

    const autoCheckRunId = randomUUID();
    input.emit({
      type: 'auto-check-started',
      taskId: input.taskId,
      sessionId: task.sessionId,
      run: { autoCheckRunId, steps: config.steps },
    });

    const result = await this.workspaceAutoCheckService.runWithProgress(
      task.cwd,
      config,
      {
        onStepStarted: ({ autoCheckRunId: emittedRunId, step }) => {
          input.emit({
            type: 'auto-check-step',
            taskId: input.taskId,
            sessionId: task.sessionId,
            step: {
              autoCheckRunId: emittedRunId,
              stepId: step.id,
              name: step.name,
              command: step.command,
              phase: 'started',
            },
          });
        },
        onStepFinished: ({ autoCheckRunId: emittedRunId, result: step }) => {
          input.emit({
            type: 'auto-check-step',
            taskId: input.taskId,
            sessionId: task.sessionId,
            step: {
              autoCheckRunId: emittedRunId,
              stepId: step.stepId,
              name: step.name,
              command: step.command,
              phase: 'finished',
              success: step.success,
              exitCode: step.exitCode,
              output: step.output,
              ranAt: step.ranAt,
            },
          });
        },
      },
      autoCheckRunId,
    );

    task.latestAutoCheckResult = result;
    input.emit({
      type: 'auto-check-completed',
      taskId: input.taskId,
      sessionId: task.sessionId,
      autoCheckRunId,
      result,
    });

    if (result.success) {
      const updatedTask = this.runtimeService.updateLifecycleState(
        input.taskId,
        'awaiting_review',
        'auto_check_passed',
        result,
      );
      input.emit({
        type: 'task-lifecycle-state-changed',
        taskId: updatedTask.taskId,
        sessionId: updatedTask.sessionId,
        state: 'awaiting_review',
        reason: 'auto_check_passed',
        mode: updatedTask.mode,
        autoCheckResult: result,
      });
      return;
    }

    const updatedTask = this.runtimeService.updateLifecycleState(
      input.taskId,
      'executing',
      'auto_check_failed',
      result,
    );
    input.emit({
      type: 'task-lifecycle-state-changed',
      taskId: updatedTask.taskId,
      sessionId: updatedTask.sessionId,
      state: 'executing',
      reason: 'auto_check_failed',
      mode: updatedTask.mode,
      autoCheckResult: result,
    });

    const failedStep = result.failedStep ?? {
      stepId: 'unknown',
      name: 'unknown',
      command: result.command,
      success: false,
      exitCode: result.exitCode,
      output: result.output,
      ranAt: result.ranAt,
    };
    const feedback = {
      ...buildAutoCheckFailureFeedback(failedStep),
      autoCheckRunId,
    };
    const turn = input.beginTurn(input.taskId, feedback.prompt);
    input.emit({
      type: 'auto-check-feedback-prepared',
      taskId: input.taskId,
      sessionId: task.sessionId,
      feedback,
    });
    input.runPrompt({
      taskId: input.taskId,
      sessionId: task.sessionId,
      turnId: turn.turnId,
      prompt: feedback.prompt,
    });
  }
}
