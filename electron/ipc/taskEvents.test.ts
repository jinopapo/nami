import { describe, expect, it } from 'vitest';
import {
  createAutoCheckCompletedEvent,
  createAutoCheckFeedbackPreparedEvent,
  createAutoCheckStartedEvent,
  createAutoCheckStepEvent,
  createTaskCreatedEvent,
  createTaskLifecycleStateChangedEvent,
} from '../mapper/taskEventMapper.js';

describe('taskEvents', () => {
  it('creates taskCreated event', () => {
    const event = createTaskCreatedEvent({
      taskId: 'task-1',
      sessionId: 'session-1',
      cwd: '/tmp',
      projectWorkspacePath: '/project',
      taskWorkspacePath: '/project.task-1',
      taskBranchName: 'task/task-1',
      taskBranchManagement: 'system_managed',
      baseBranchName: 'main',
      reviewMergePolicy: 'merge_to_base',
      createdAt: '2026-03-18T00:00:00.000Z',
      updatedAt: '2026-03-18T00:00:00.000Z',
      mode: 'act',
      lifecycleState: 'executing',
      runtimeState: 'running',
      workspaceStatus: 'ready',
      mergeStatus: 'idle',
      dependencyTaskIds: ['task-0'],
      pendingDependencyTaskIds: [],
    });

    expect(event).toMatchObject({
      type: 'taskCreated',
      task: {
        taskId: 'task-1',
        sessionId: 'session-1',
        dependencyTaskIds: ['task-0'],
        pendingDependencyTaskIds: [],
      },
    });
  });

  it('creates task lifecycle state changed event', () => {
    expect(
      createTaskLifecycleStateChangedEvent(
        'task-1',
        'session-1',
        'awaiting_review',
        'end_turn',
        'act',
        {
          projectWorkspacePath: '/project',
          taskWorkspacePath: '/project.task-1',
          taskBranchName: 'task/task-1',
          taskBranchManagement: 'system_managed',
          baseBranchName: 'main',
          reviewMergePolicy: 'preserve_branch',
          workspaceStatus: 'ready',
          mergeStatus: 'idle',
          dependencyTaskIds: ['task-0'],
          pendingDependencyTaskIds: ['task-0'],
        },
      ),
    ).toMatchObject({
      type: 'taskLifecycleStateChanged',
      state: 'awaiting_review',
      mode: 'act',
      reason: 'end_turn',
      taskWorkspacePath: '/project.task-1',
      reviewMergePolicy: 'preserve_branch',
      dependencyTaskIds: ['task-0'],
      pendingDependencyTaskIds: ['task-0'],
    });
  });

  it('creates auto check progress events', () => {
    expect(
      createAutoCheckStartedEvent('task-1', 'session-1', {
        autoCheckRunId: 'run-1',
        steps: [{ id: 'step-1', name: 'Lint', command: 'npm run lint' }],
      }),
    ).toMatchObject({
      type: 'autoCheckStarted',
      run: { autoCheckRunId: 'run-1' },
    });

    expect(
      createAutoCheckStepEvent('task-1', 'session-1', {
        autoCheckRunId: 'run-1',
        stepId: 'step-1',
        name: 'Lint',
        command: 'npm run lint',
        phase: 'finished',
        success: true,
      }),
    ).toMatchObject({
      type: 'autoCheckStep',
      step: { stepId: 'step-1', success: true },
    });

    expect(
      createAutoCheckCompletedEvent('task-1', 'session-1', 'run-1', {
        success: true,
        exitCode: 0,
        output: '',
        command: 'npm run lint',
        ranAt: '2026-03-18T00:00:00.000Z',
        steps: [],
      }),
    ).toMatchObject({
      type: 'autoCheckCompleted',
      autoCheckRunId: 'run-1',
    });

    expect(
      createAutoCheckFeedbackPreparedEvent('task-1', 'session-1', {
        autoCheckRunId: 'run-1',
        stepId: 'step-1',
        name: 'Lint',
        command: 'npm run lint',
        exitCode: 1,
        output: 'failed',
        prompt: 'feedback',
      }),
    ).toMatchObject({
      type: 'autoCheckFeedbackPrepared',
      feedback: { prompt: 'feedback' },
    });
  });
});
