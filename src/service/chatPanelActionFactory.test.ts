/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_service'. Dependency is of type 'src_service' */
import { describe, expect, it, vi } from 'vitest';
import { createTaskLifecycleActionHandler } from './chatPanelActionFactory';

describe('createTaskLifecycleActionHandler', () => {
  it('calls resumeTask for retry actions without transitioning lifecycle', async () => {
    const transitionLifecycle = vi.fn();
    const appendLocalEvent = vi.fn();
    const resumeTask = vi.fn().mockResolvedValue(undefined);
    const setBootError = vi.fn();
    const handler = createTaskLifecycleActionHandler({
      activeTask: { taskId: 'task-1' },
      shouldEnterPlanRevisionMode: () => false,
      enterPlanRevisionMode: vi.fn(),
      exitPlanRevisionMode: vi.fn(),
      transitionLifecycle,
      createRetryEvent: () => ({ type: 'taskStateChanged', reason: 'resume' }),
      appendLocalEvent,
      resumeTask,
      setBootError,
    });

    await handler({ key: 'retry-error', nextState: 'planning' });

    expect(appendLocalEvent).toHaveBeenCalledWith('task-1', {
      type: 'taskStateChanged',
      reason: 'resume',
    });
    expect(resumeTask).toHaveBeenCalledWith({
      taskId: 'task-1',
      reason: 'resume',
    });
    expect(transitionLifecycle).not.toHaveBeenCalled();
    expect(setBootError).toHaveBeenCalledWith(null);
  });

  it('notifies transition hooks when lifecycle transition starts and fails', async () => {
    const transitionLifecycle = vi
      .fn()
      .mockRejectedValue(new Error('transition failed'));
    const onTransitionStart = vi.fn();
    const onTransitionError = vi.fn();
    const setBootError = vi.fn();
    const handler = createTaskLifecycleActionHandler({
      activeTask: { taskId: 'task-1' },
      shouldEnterPlanRevisionMode: () => false,
      enterPlanRevisionMode: vi.fn(),
      exitPlanRevisionMode: vi.fn(),
      transitionLifecycle,
      createRetryEvent: () => ({ type: 'taskStateChanged', reason: 'resume' }),
      appendLocalEvent: vi.fn(),
      resumeTask: vi.fn().mockResolvedValue(undefined),
      setBootError,
      onTransitionStart,
      onTransitionError,
    });

    await handler({ key: 'start-planning', nextState: 'planning' });

    expect(onTransitionStart).toHaveBeenCalledWith({
      key: 'start-planning',
      nextState: 'planning',
    });
    expect(onTransitionError).toHaveBeenCalledWith({
      key: 'start-planning',
      nextState: 'planning',
    });
    expect(setBootError).toHaveBeenCalledWith('transition failed');
  });
});
