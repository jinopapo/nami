/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'share' */
import type { TaskLifecycleState } from '../../share/task.js';
import type { TaskRuntime } from '../entity/clineSession.js';

const EXECUTION_START_PROMPT =
  'これまでの計画を踏まえて、actモードとして実行を開始してください。';

const TRANSITIONS: Record<TaskLifecycleState, TaskLifecycleState[]> = {
  before_start: ['planning'],
  planning: ['awaiting_confirmation'],
  awaiting_confirmation: ['planning', 'executing'],
  executing: ['auto_checking', 'awaiting_review'],
  auto_checking: ['executing', 'awaiting_review'],
  awaiting_review: ['completed'],
  completed: [],
};

type TransitionTaskLifecycleInput = {
  nextState: TaskLifecycleState;
  prompt?: string;
};

type HumanTransitionResolution =
  | {
      kind: 'restart';
      mode: 'plan' | 'act';
      lifecycleState: TaskLifecycleState;
      prompt: string;
      reason: string;
    }
  | {
      kind: 'transition';
      lifecycleState: TaskLifecycleState;
      reason: string;
    };

type PostPromptResolution =
  | { kind: 'none' }
  | {
      kind: 'transition';
      lifecycleState: TaskLifecycleState;
      reason: string;
    }
  | {
      kind: 'execution-completed';
      reason?: string;
    };

const isPlanningCompletionStopReason = (stopReason?: string): boolean =>
  ['end_turn', 'completed'].includes(stopReason ?? '');

const isExecutionCompletionStopReason = (stopReason?: string): boolean =>
  ['end_turn', 'completed'].includes(stopReason ?? '');

export class ClineTaskLifecycleCoordinator {
  resolveHumanTransition(
    task: TaskRuntime,
    input: TransitionTaskLifecycleInput,
  ): HumanTransitionResolution {
    const allowed = TRANSITIONS[task.lifecycleState] ?? [];
    if (!allowed.includes(input.nextState)) {
      throw new Error(
        `Invalid lifecycle transition: ${task.lifecycleState} -> ${input.nextState}`,
      );
    }

    if (
      task.lifecycleState === 'before_start' &&
      input.nextState === 'planning'
    ) {
      const prompt = task.initialPrompt.trim();
      if (!prompt) {
        throw new Error('Initial prompt is required when starting planning.');
      }

      return {
        kind: 'restart',
        mode: 'plan',
        lifecycleState: 'planning',
        prompt,
        reason: 'start_planning',
      };
    }

    if (
      task.lifecycleState === 'awaiting_confirmation' &&
      input.nextState === 'planning'
    ) {
      const prompt = input.prompt?.trim();
      if (!prompt) {
        throw new Error('Prompt is required when restarting planning.');
      }

      return {
        kind: 'restart',
        mode: 'plan',
        lifecycleState: 'planning',
        prompt,
        reason: 'retry_planning',
      };
    }

    if (
      task.lifecycleState === 'awaiting_confirmation' &&
      input.nextState === 'executing'
    ) {
      return {
        kind: 'restart',
        mode: 'act',
        lifecycleState: 'executing',
        prompt: EXECUTION_START_PROMPT,
        reason: 'start_execution',
      };
    }

    return {
      kind: 'transition',
      lifecycleState: input.nextState,
      reason: 'human_transition',
    };
  }

  shouldSyncAfterPrompt(stopReason?: string): boolean {
    return (
      isPlanningCompletionStopReason(stopReason) ||
      isExecutionCompletionStopReason(stopReason)
    );
  }

  resolvePostPrompt(
    task: TaskRuntime,
    stopReason?: string,
  ): PostPromptResolution {
    if (
      task.lifecycleState === 'planning' &&
      isPlanningCompletionStopReason(stopReason)
    ) {
      return {
        kind: 'transition',
        lifecycleState: 'awaiting_confirmation',
        reason: stopReason ?? 'plan_turn_completed',
      };
    }

    if (
      task.lifecycleState === 'executing' &&
      isExecutionCompletionStopReason(stopReason)
    ) {
      return {
        kind: 'execution-completed',
        reason: stopReason,
      };
    }

    return { kind: 'none' };
  }
}
