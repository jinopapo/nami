/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'share' */
import { randomUUID } from 'node:crypto';
import type {
  AutoCheckConfig,
  AutoCheckFeedbackEvent,
  AutoCheckResult,
  AutoCheckRunSummary,
  AutoCheckStepEvent,
  AutoCheckStepResult,
  TaskLifecycleState,
} from '../../share/task.js';
import type { TaskRuntime } from '../entity/clineSession.js';

const AUTO_CHECK_FAILURE_PROMPT =
  '自動チェックに失敗しました。失敗したチェック結果だけを確認して修正してください。';

const buildAutoCheckFailureFeedback = (
  failedStep: AutoCheckStepResult,
): AutoCheckFeedbackEvent => {
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

type PromptInput = {
  taskId: string;
  sessionId: string;
  turnId: string;
  prompt: string;
};

type LifecycleEmitter = (
  taskId: string,
  sessionId: string,
  state: TaskLifecycleState,
  reason?: string,
  mode?: 'plan' | 'act',
  autoCheckResult?: AutoCheckResult,
) => void;

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
    onProgress?: (event: AutoCheckStepEvent) => void,
    autoCheckRunId?: string,
  ): Promise<AutoCheckResult>;
};

export class ClineAutoCheckCoordinator {
  constructor(
    private readonly runtimeService: RuntimeServicePort,
    private readonly workspaceAutoCheckService: WorkspaceAutoCheckPort,
  ) {}

  async handleExecutionCompleted(input: {
    taskId: string;
    reason?: string;
    emitLifecycleStateChanged: LifecycleEmitter;
    emitAutoCheckStarted: (
      taskId: string,
      sessionId: string,
      run: AutoCheckRunSummary,
    ) => void;
    emitAutoCheckStep: (
      taskId: string,
      sessionId: string,
      step: AutoCheckStepEvent,
    ) => void;
    emitAutoCheckCompleted: (
      taskId: string,
      sessionId: string,
      autoCheckRunId: string,
      result: AutoCheckResult,
    ) => void;
    emitAutoCheckFeedbackPrepared: (
      taskId: string,
      sessionId: string,
      feedback: AutoCheckFeedbackEvent,
    ) => void;
    beginTurn: (taskId: string) => { turnId: string };
    runPrompt: (input: PromptInput) => void;
  }): Promise<void> {
    const task = this.runtimeService.getTask(input.taskId);
    const config = await this.workspaceAutoCheckService.getConfig(task.cwd);
    task.autoCheckConfig = config;

    if (!config.enabled || config.steps.length === 0) {
      const updatedTask = this.runtimeService.updateLifecycleState(
        input.taskId,
        'awaiting_review',
        input.reason,
      );
      input.emitLifecycleStateChanged(
        updatedTask.taskId,
        updatedTask.sessionId,
        'awaiting_review',
        input.reason,
        updatedTask.mode,
      );
      return;
    }

    const autoCheckingTask = this.runtimeService.updateLifecycleState(
      input.taskId,
      'auto_checking',
      'auto_check_started',
    );
    input.emitLifecycleStateChanged(
      autoCheckingTask.taskId,
      autoCheckingTask.sessionId,
      'auto_checking',
      'auto_check_started',
      autoCheckingTask.mode,
    );

    const autoCheckRunId = randomUUID();
    input.emitAutoCheckStarted(input.taskId, task.sessionId, {
      autoCheckRunId,
      steps: config.steps,
    });

    const result = await this.workspaceAutoCheckService.runWithProgress(
      task.cwd,
      config,
      (step) => {
        input.emitAutoCheckStep(input.taskId, task.sessionId, step);
      },
      autoCheckRunId,
    );

    task.latestAutoCheckResult = result;
    input.emitAutoCheckCompleted(
      input.taskId,
      task.sessionId,
      autoCheckRunId,
      result,
    );

    if (result.success) {
      const updatedTask = this.runtimeService.updateLifecycleState(
        input.taskId,
        'awaiting_review',
        'auto_check_passed',
        result,
      );
      input.emitLifecycleStateChanged(
        updatedTask.taskId,
        updatedTask.sessionId,
        'awaiting_review',
        'auto_check_passed',
        updatedTask.mode,
        result,
      );
      return;
    }

    const updatedTask = this.runtimeService.updateLifecycleState(
      input.taskId,
      'executing',
      'auto_check_failed',
      result,
    );
    input.emitLifecycleStateChanged(
      updatedTask.taskId,
      updatedTask.sessionId,
      'executing',
      'auto_check_failed',
      updatedTask.mode,
      result,
    );

    const turn = input.beginTurn(input.taskId);
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
    input.emitAutoCheckFeedbackPrepared(input.taskId, task.sessionId, feedback);
    input.runPrompt({
      taskId: input.taskId,
      sessionId: task.sessionId,
      turnId: turn.turnId,
      prompt: feedback.prompt,
    });
  }
}
