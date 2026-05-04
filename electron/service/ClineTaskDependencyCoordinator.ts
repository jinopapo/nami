import type { TaskRuntime } from '../entity/clineSession.js';

type LifecycleEmitter = (
  taskId: string,
  sessionId: string,
  state: TaskRuntime['lifecycleState'],
  reason?: string,
  mode?: TaskRuntime['mode'],
) => void;

type StartPlanningInput = {
  taskId: string;
  mode: 'plan';
  lifecycleState: 'planning';
  prompt: string;
  reason: 'start_planning';
};

type RuntimeServicePort = {
  getTask(taskId: string): TaskRuntime;
  listTasks(): TaskRuntime[];
  updateLifecycleState(
    taskId: string,
    state: TaskRuntime['lifecycleState'],
    reason?: string,
  ): TaskRuntime;
  updateTaskDependencies(
    taskId: string,
    input: {
      dependencyTaskIds: string[];
      pendingDependencyTaskIds: string[];
    },
  ): TaskRuntime;
};

type DependencyResolution = {
  dependencyTaskIds: string[];
  pendingDependencyTaskIds: string[];
};

type DependencyCallbacks = {
  emitLifecycleStateChanged: LifecycleEmitter;
  startPlanning: (input: StartPlanningInput) => Promise<void>;
};

export class ClineTaskDependencyCoordinator {
  constructor(private readonly runtimeService: RuntimeServicePort) {}

  resolveDependenciesForTask(input: {
    taskId: string;
    dependencyTaskIds: string[] | undefined;
    reviewMergePolicy: TaskRuntime['reviewMergePolicy'];
  }): DependencyResolution {
    const dependencyTaskIds = this.normalizeDependencyTaskIds(
      input.dependencyTaskIds,
    );
    return {
      dependencyTaskIds,
      pendingDependencyTaskIds: this.validateAndResolvePendingDependencies({
        taskId: input.taskId,
        dependencyTaskIds,
        reviewMergePolicy: input.reviewMergePolicy,
      }),
    };
  }

  async updateTaskDependencies(
    input: {
      taskId: string;
      dependencyTaskIds: string[];
    },
    callbacks: DependencyCallbacks,
  ): Promise<void> {
    const task = this.runtimeService.getTask(input.taskId);
    if (
      !['waiting_dependencies', 'before_start'].includes(task.lifecycleState)
    ) {
      throw new Error(
        'Dependencies can only be edited before task execution starts.',
      );
    }

    const dependencyResolution = this.resolveDependenciesForTask({
      taskId: task.taskId,
      dependencyTaskIds: input.dependencyTaskIds,
      reviewMergePolicy: task.reviewMergePolicy,
    });
    const updatedTask = this.runtimeService.updateTaskDependencies(
      task.taskId,
      dependencyResolution,
    );

    if (dependencyResolution.dependencyTaskIds.length === 0) {
      if (updatedTask.lifecycleState === 'waiting_dependencies') {
        const unblockedTask = this.runtimeService.updateLifecycleState(
          task.taskId,
          'before_start',
          'dependencies_cleared',
        );
        callbacks.emitLifecycleStateChanged(
          unblockedTask.taskId,
          unblockedTask.sessionId,
          unblockedTask.lifecycleState,
          'dependencies_cleared',
          unblockedTask.mode,
        );
        await callbacks.startPlanning({
          taskId: unblockedTask.taskId,
          mode: 'plan',
          lifecycleState: 'planning',
          prompt: unblockedTask.initialPrompt,
          reason: 'start_planning',
        });
        return;
      }
      callbacks.emitLifecycleStateChanged(
        updatedTask.taskId,
        updatedTask.sessionId,
        updatedTask.lifecycleState,
        'dependencies_updated',
        updatedTask.mode,
      );
      return;
    }

    if (dependencyResolution.pendingDependencyTaskIds.length > 0) {
      const blockedTask =
        updatedTask.lifecycleState === 'waiting_dependencies'
          ? updatedTask
          : this.runtimeService.updateLifecycleState(
              task.taskId,
              'waiting_dependencies',
              'waiting_dependencies',
            );
      callbacks.emitLifecycleStateChanged(
        blockedTask.taskId,
        blockedTask.sessionId,
        blockedTask.lifecycleState,
        blockedTask.lifecycleState === 'waiting_dependencies'
          ? 'dependencies_updated'
          : 'waiting_dependencies',
        blockedTask.mode,
      );
      return;
    }

    callbacks.emitLifecycleStateChanged(
      updatedTask.taskId,
      updatedTask.sessionId,
      updatedTask.lifecycleState,
      'dependencies_resolved',
      updatedTask.mode,
    );
    await this.autoStartTaskWhenDependenciesResolved(task.taskId, callbacks);
  }

  async reconcileDependentTasks(
    completedTaskId: string,
    callbacks: DependencyCallbacks,
  ): Promise<void> {
    const dependentTasks = this.runtimeService
      .listTasks()
      .filter((task) => task.dependencyTaskIds.includes(completedTaskId));

    for (const dependentTask of dependentTasks) {
      const pendingDependencyTaskIds =
        this.validateAndResolvePendingDependencies({
          taskId: dependentTask.taskId,
          dependencyTaskIds: dependentTask.dependencyTaskIds,
          reviewMergePolicy: dependentTask.reviewMergePolicy,
        });
      const updatedTask = this.runtimeService.updateTaskDependencies(
        dependentTask.taskId,
        {
          dependencyTaskIds: dependentTask.dependencyTaskIds,
          pendingDependencyTaskIds,
        },
      );

      if (pendingDependencyTaskIds.length > 0) {
        callbacks.emitLifecycleStateChanged(
          updatedTask.taskId,
          updatedTask.sessionId,
          updatedTask.lifecycleState,
          'dependencies_updated',
          updatedTask.mode,
        );
        continue;
      }

      await this.autoStartTaskWhenDependenciesResolved(
        dependentTask.taskId,
        callbacks,
      );
    }
  }

  async autoStartTaskWhenDependenciesResolved(
    taskId: string,
    callbacks: DependencyCallbacks,
  ): Promise<void> {
    const task = this.runtimeService.getTask(taskId);
    if (
      task.dependencyTaskIds.length === 0 ||
      task.pendingDependencyTaskIds.length > 0
    ) {
      return;
    }
    if (
      !['waiting_dependencies', 'before_start'].includes(task.lifecycleState)
    ) {
      return;
    }

    const isAlreadyBeforeStart = task.lifecycleState === 'before_start';
    const readyTask = isAlreadyBeforeStart
      ? task
      : this.runtimeService.updateLifecycleState(
          taskId,
          'before_start',
          'dependencies_resolved',
        );
    if (!isAlreadyBeforeStart) {
      callbacks.emitLifecycleStateChanged(
        readyTask.taskId,
        readyTask.sessionId,
        readyTask.lifecycleState,
        'dependencies_resolved',
        readyTask.mode,
      );
    }

    await callbacks.startPlanning({
      taskId,
      mode: 'plan',
      lifecycleState: 'planning',
      prompt: readyTask.initialPrompt,
      reason: 'start_planning',
    });
  }

  private normalizeDependencyTaskIds(
    dependencyTaskIds: string[] | undefined,
  ): string[] {
    return [
      ...new Set((dependencyTaskIds ?? []).map((taskId) => taskId.trim())),
    ].filter((taskId) => taskId.length > 0);
  }

  private validateAndResolvePendingDependencies(input: {
    taskId: string;
    dependencyTaskIds: string[];
    reviewMergePolicy: TaskRuntime['reviewMergePolicy'];
  }): string[] {
    if (input.dependencyTaskIds.length === 0) {
      return [];
    }
    if (input.reviewMergePolicy !== 'merge_to_base') {
      throw new Error(
        'Tasks with dependencies must merge changes back to the base branch.',
      );
    }

    const tasksById = new Map(
      this.runtimeService.listTasks().map((task) => [task.taskId, task]),
    );
    for (const dependencyTaskId of input.dependencyTaskIds) {
      if (dependencyTaskId === input.taskId) {
        throw new Error('A task cannot depend on itself.');
      }
      const dependencyTask = tasksById.get(dependencyTaskId);
      if (!dependencyTask) {
        throw new Error(`Dependency task not found: ${dependencyTaskId}`);
      }
      if (dependencyTask.reviewMergePolicy !== 'merge_to_base') {
        throw new Error(
          'Only tasks that merge to the base branch can be used as dependencies.',
        );
      }
    }

    const dependencyGraph = new Map(
      this.runtimeService
        .listTasks()
        .map((task) => [task.taskId, task.dependencyTaskIds]),
    );
    dependencyGraph.set(input.taskId, input.dependencyTaskIds);
    for (const dependencyTaskId of input.dependencyTaskIds) {
      if (
        this.hasDependencyPath(dependencyGraph, dependencyTaskId, input.taskId)
      ) {
        throw new Error('Circular task dependencies are not allowed.');
      }
    }

    return input.dependencyTaskIds.filter((dependencyTaskId) => {
      const dependencyTask = tasksById.get(dependencyTaskId);
      return dependencyTask?.lifecycleState !== 'completed';
    });
  }

  private hasDependencyPath(
    dependencyGraph: Map<string, string[]>,
    fromTaskId: string,
    targetTaskId: string,
  ): boolean {
    const visited = new Set<string>();
    const visit = (taskId: string): boolean => {
      if (taskId === targetTaskId) {
        return true;
      }
      if (visited.has(taskId)) {
        return false;
      }
      visited.add(taskId);
      return (dependencyGraph.get(taskId) ?? []).some((dependencyTaskId) =>
        visit(dependencyTaskId),
      );
    };

    return visit(fromTaskId);
  }
}
