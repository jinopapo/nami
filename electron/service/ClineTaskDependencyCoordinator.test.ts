/* eslint-disable boundaries/element-types -- Service tests exercise service-layer collaborators directly. */
import { describe, expect, it, vi } from 'vitest';
import type { TaskRuntime } from '../entity/clineSession.js';
import { ClineTaskDependencyCoordinator } from './ClineTaskDependencyCoordinator.js';

class FakeRuntimeService {
  private readonly tasks = new Map<string, TaskRuntime>();

  constructor(tasks: TaskRuntime[]) {
    for (const task of tasks) {
      this.tasks.set(task.taskId, task);
    }
  }

  getTask(taskId: string): TaskRuntime {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    return task;
  }

  listTasks(): TaskRuntime[] {
    return [...this.tasks.values()];
  }

  updateLifecycleState(
    taskId: string,
    state: TaskRuntime['lifecycleState'],
    _reason?: string,
  ): TaskRuntime {
    const task = this.getTask(taskId);
    task.lifecycleState = state;
    task.updatedAt = '2026-05-02T00:00:00.000Z';
    return task;
  }

  updateTaskDependencies(
    taskId: string,
    input: {
      dependencyTaskIds: string[];
      pendingDependencyTaskIds: string[];
    },
  ): TaskRuntime {
    const task = this.getTask(taskId);
    task.dependencyTaskIds = [...input.dependencyTaskIds];
    task.pendingDependencyTaskIds = [...input.pendingDependencyTaskIds];
    task.updatedAt = '2026-05-02T00:00:00.000Z';
    return task;
  }
}

const createTask = (
  taskId: string,
  overrides: Partial<TaskRuntime> = {},
): TaskRuntime => ({
  taskId,
  sessionId: `${taskId}-session`,
  cwd: '/tmp',
  projectWorkspacePath: '/tmp',
  taskWorkspacePath: '',
  taskBranchName: `task/${taskId}`,
  taskBranchManagement: 'system_managed',
  baseBranchName: 'main',
  reviewMergePolicy: 'merge_to_base',
  createdAt: '2026-05-02T00:00:00.000Z',
  updatedAt: '2026-05-02T00:00:00.000Z',
  mode: 'plan',
  lifecycleState: 'before_start',
  runtimeState: 'idle',
  workspaceStatus: 'initializing',
  mergeStatus: 'idle',
  dependencyTaskIds: [],
  pendingDependencyTaskIds: [],
  initialPrompt: `${taskId} prompt`,
  turns: [],
  ...overrides,
});

const createCallbacks = () => ({
  emitLifecycleStateChanged: vi.fn(),
  startPlanning: vi.fn().mockResolvedValue(undefined),
});

describe('ClineTaskDependencyCoordinator', () => {
  it('normalizes dependency ids and excludes completed dependencies from pending ids', () => {
    const runtimeService = new FakeRuntimeService([
      createTask('parent'),
      createTask('completed-parent', { lifecycleState: 'completed' }),
    ]);
    const coordinator = new ClineTaskDependencyCoordinator(runtimeService);

    const result = coordinator.resolveDependenciesForTask({
      taskId: 'child',
      dependencyTaskIds: [' parent ', '', 'parent', ' completed-parent ', ' '],
      reviewMergePolicy: 'merge_to_base',
    });

    expect(result).toEqual({
      dependencyTaskIds: ['parent', 'completed-parent'],
      pendingDependencyTaskIds: ['parent'],
    });
  });

  it('rejects invalid dependency definitions', () => {
    const runtimeService = new FakeRuntimeService([
      createTask('parent'),
      createTask('preserve-parent', { reviewMergePolicy: 'preserve_branch' }),
    ]);
    const coordinator = new ClineTaskDependencyCoordinator(runtimeService);

    expect(() =>
      coordinator.resolveDependenciesForTask({
        taskId: 'child',
        dependencyTaskIds: ['child'],
        reviewMergePolicy: 'merge_to_base',
      }),
    ).toThrow('A task cannot depend on itself.');
    expect(() =>
      coordinator.resolveDependenciesForTask({
        taskId: 'child',
        dependencyTaskIds: ['missing'],
        reviewMergePolicy: 'merge_to_base',
      }),
    ).toThrow('Dependency task not found: missing');
    expect(() =>
      coordinator.resolveDependenciesForTask({
        taskId: 'child',
        dependencyTaskIds: ['parent'],
        reviewMergePolicy: 'preserve_branch',
      }),
    ).toThrow(
      'Tasks with dependencies must merge changes back to the base branch.',
    );
    expect(() =>
      coordinator.resolveDependenciesForTask({
        taskId: 'child',
        dependencyTaskIds: ['preserve-parent'],
        reviewMergePolicy: 'merge_to_base',
      }),
    ).toThrow(
      'Only tasks that merge to the base branch can be used as dependencies.',
    );
  });

  it('rejects circular dependencies', () => {
    const runtimeService = new FakeRuntimeService([
      createTask('task-a', { dependencyTaskIds: ['task-b'] }),
      createTask('task-b', { dependencyTaskIds: ['task-c'] }),
      createTask('task-c'),
    ]);
    const coordinator = new ClineTaskDependencyCoordinator(runtimeService);

    expect(() =>
      coordinator.resolveDependenciesForTask({
        taskId: 'task-c',
        dependencyTaskIds: ['task-a'],
        reviewMergePolicy: 'merge_to_base',
      }),
    ).toThrow('Circular task dependencies are not allowed.');
  });

  it('reconciles dependent tasks and starts planning after all dependencies complete', async () => {
    const runtimeService = new FakeRuntimeService([
      createTask('parent', { lifecycleState: 'completed' }),
      createTask('child', {
        dependencyTaskIds: ['parent'],
        pendingDependencyTaskIds: ['parent'],
        lifecycleState: 'waiting_dependencies',
      }),
    ]);
    const coordinator = new ClineTaskDependencyCoordinator(runtimeService);
    const callbacks = createCallbacks();

    await coordinator.reconcileDependentTasks('parent', callbacks);

    const child = runtimeService.getTask('child');
    expect(child.pendingDependencyTaskIds).toEqual([]);
    expect(child.lifecycleState).toBe('before_start');
    expect(callbacks.emitLifecycleStateChanged).toHaveBeenCalledWith(
      'child',
      'child-session',
      'before_start',
      'dependencies_resolved',
      'plan',
    );
    expect(callbacks.startPlanning).toHaveBeenCalledWith({
      taskId: 'child',
      mode: 'plan',
      lifecycleState: 'planning',
      prompt: 'child prompt',
      reason: 'start_planning',
    });
  });

  it('keeps dependent tasks waiting while another dependency is still pending', async () => {
    const runtimeService = new FakeRuntimeService([
      createTask('completed-parent', { lifecycleState: 'completed' }),
      createTask('pending-parent'),
      createTask('child', {
        dependencyTaskIds: ['completed-parent', 'pending-parent'],
        pendingDependencyTaskIds: ['completed-parent', 'pending-parent'],
        lifecycleState: 'waiting_dependencies',
      }),
    ]);
    const coordinator = new ClineTaskDependencyCoordinator(runtimeService);
    const callbacks = createCallbacks();

    await coordinator.reconcileDependentTasks('completed-parent', callbacks);

    const child = runtimeService.getTask('child');
    expect(child.pendingDependencyTaskIds).toEqual(['pending-parent']);
    expect(child.lifecycleState).toBe('waiting_dependencies');
    expect(callbacks.emitLifecycleStateChanged).toHaveBeenCalledWith(
      'child',
      'child-session',
      'waiting_dependencies',
      'dependencies_updated',
      'plan',
    );
    expect(callbacks.startPlanning).not.toHaveBeenCalled();
  });
});
