import { describe, expect, it } from 'vitest';
import type { TaskRuntime } from '../../electron/entity/clineSession.js';
import { ClineTaskLifecycleCoordinator } from '../../electron/service/ClineTaskLifecycleCoordinator.js';

const createTask = (
  lifecycleState: TaskRuntime['lifecycleState'],
  overrides: Partial<TaskRuntime> = {},
): TaskRuntime => ({
  taskId: 'task-1',
  sessionId: 'session-1',
  cwd: '/tmp',
  projectWorkspacePath: '/tmp',
  taskWorkspacePath: '/tmp/task-1',
  taskBranchName: 'task/task-1',
  taskBranchManagement: 'system_managed',
  baseBranchName: 'main',
  reviewMergePolicy: 'merge_to_base',
  createdAt: '2026-05-02T00:00:00.000Z',
  updatedAt: '2026-05-02T00:00:00.000Z',
  mode: 'plan',
  lifecycleState,
  runtimeState: 'idle',
  workspaceStatus: 'ready',
  mergeStatus: 'idle',
  dependencyTaskIds: [],
  pendingDependencyTaskIds: [],
  initialPrompt: 'initial prompt',
  turns: [],
  ...overrides,
});

describe('ClineTaskLifecycleCoordinator', () => {
  it('starts planning from before_start with the initial prompt', () => {
    const coordinator = new ClineTaskLifecycleCoordinator();

    const result = coordinator.resolveHumanTransition(
      createTask('before_start'),
      {
        nextState: 'planning',
      },
    );

    expect(result).toEqual({
      kind: 'restart',
      mode: 'plan',
      lifecycleState: 'planning',
      prompt: 'initial prompt',
      reason: 'start_planning',
    });
  });

  it('rejects starting planning from before_start when the initial prompt is blank', () => {
    const coordinator = new ClineTaskLifecycleCoordinator();

    expect(() =>
      coordinator.resolveHumanTransition(
        createTask('before_start', { initialPrompt: '   ' }),
        { nextState: 'planning' },
      ),
    ).toThrow('Initial prompt is required when starting planning.');
  });

  it('restarts planning from awaiting_confirmation with the provided prompt', () => {
    const coordinator = new ClineTaskLifecycleCoordinator();

    const result = coordinator.resolveHumanTransition(
      createTask('awaiting_confirmation'),
      {
        nextState: 'planning',
        prompt: '計画を更新して',
      },
    );

    expect(result).toEqual({
      kind: 'restart',
      mode: 'plan',
      lifecycleState: 'planning',
      prompt: '計画を更新して',
      reason: 'retry_planning',
    });
  });

  it('rejects restarting planning from awaiting_confirmation without a prompt', () => {
    const coordinator = new ClineTaskLifecycleCoordinator();

    expect(() =>
      coordinator.resolveHumanTransition(createTask('awaiting_confirmation'), {
        nextState: 'planning',
      }),
    ).toThrow('Prompt is required when restarting planning.');
  });

  it('starts execution from awaiting_confirmation with the execution prompt', () => {
    const coordinator = new ClineTaskLifecycleCoordinator();

    const result = coordinator.resolveHumanTransition(
      createTask('awaiting_confirmation'),
      {
        nextState: 'executing',
      },
    );

    expect(result).toEqual({
      kind: 'restart',
      mode: 'act',
      lifecycleState: 'executing',
      prompt:
        'これまでの計画を踏まえて、actモードとして実行を開始してください。',
      reason: 'start_execution',
    });
  });

  it('returns a direct transition for supported non-restart moves', () => {
    const coordinator = new ClineTaskLifecycleCoordinator();

    const result = coordinator.resolveHumanTransition(
      createTask('awaiting_review'),
      {
        nextState: 'completed',
      },
    );

    expect(result).toEqual({
      kind: 'transition',
      lifecycleState: 'completed',
      reason: 'human_transition',
    });
  });

  it('rejects invalid lifecycle transitions', () => {
    const coordinator = new ClineTaskLifecycleCoordinator();

    expect(() =>
      coordinator.resolveHumanTransition(createTask('planning'), {
        nextState: 'completed',
      }),
    ).toThrow('Invalid lifecycle transition: planning -> completed');
  });

  it('syncs after planning completion stop reasons', () => {
    const coordinator = new ClineTaskLifecycleCoordinator();

    expect(coordinator.shouldSyncAfterPrompt('end_turn')).toBe(true);
    expect(coordinator.shouldSyncAfterPrompt('completed')).toBe(true);
    expect(coordinator.shouldSyncAfterPrompt('cancelled')).toBe(false);
  });

  it('moves planning tasks to awaiting_confirmation after supported stop reasons', () => {
    const coordinator = new ClineTaskLifecycleCoordinator();

    const result = coordinator.resolvePostPrompt(
      createTask('planning'),
      'completed',
    );

    expect(result).toEqual({
      kind: 'transition',
      lifecycleState: 'awaiting_confirmation',
      reason: 'completed',
    });
  });

  it('marks execution as completed after supported stop reasons', () => {
    const coordinator = new ClineTaskLifecycleCoordinator();

    const result = coordinator.resolvePostPrompt(
      createTask('executing', { mode: 'act' }),
      'end_turn',
    );

    expect(result).toEqual({
      kind: 'execution-completed',
      reason: 'end_turn',
    });
  });

  it('returns none when no post-prompt transition applies', () => {
    const coordinator = new ClineTaskLifecycleCoordinator();

    const result = coordinator.resolvePostPrompt(
      createTask('planning'),
      'cancelled',
    );

    expect(result).toEqual({ kind: 'none' });
  });
});
