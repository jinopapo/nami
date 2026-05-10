/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_service'. Dependency is of type 'src_service' */
import { describe, expect, it, vi } from 'vitest';
import { createChatPanelCommandActions } from './chatPanelCommandActionService';

describe('createChatPanelCommandActions', () => {
  it('creates a task and promotes the optimistic session in create mode', async () => {
    const beginOptimisticSession = vi.fn(() => ({
      temporaryTaskId: 'pending-1',
    }));
    const setPendingTaskCreationId = vi.fn();
    const openDrawer = vi.fn();
    const promoteOptimisticSession = vi.fn();
    const selectTask = vi.fn();
    const clearDraft = vi.fn();
    const exitPlanRevisionMode = vi.fn();
    const setCwd = vi.fn();
    const setBootError = vi.fn();
    const createTask = vi.fn().mockResolvedValue({
      taskId: 'task-1',
      sessionId: 'session-1',
    });
    const actions = createChatPanelCommandActions(
      {
        cwd: '/repo',
        setCwd,
        prompt: 'hello',
        sendMode: 'create',
        reviewMergePolicy: 'merge_to_base',
        taskBranchName: 'feature/task-1',
        dependencyTaskIds: ['task-2'],
        beginOptimisticSession,
        setPendingTaskCreationId,
        openDrawer,
        promoteOptimisticSession,
        selectTask,
        appendOptimisticUserEvent: vi.fn(),
        clearDraft,
        exitPlanRevisionMode,
        discardOptimisticSession: vi.fn(),
        createApprovalResolvedEvents: vi.fn(() => []),
        appendLocalEvent: vi.fn(),
        createAbortEvent: vi.fn(),
        shouldEnterPlanRevisionMode: vi.fn(() => false),
        enterPlanRevisionMode: vi.fn(),
        createRetryEvent: vi.fn(),
        setBootError,
      },
      {
        selectDirectory: vi.fn(),
        openWindow: vi.fn(),
        createTask,
        transitionLifecycle: vi.fn(),
        sendMessage: vi.fn(),
        resumeTask: vi.fn(),
        abortTask: vi.fn(),
      },
    );

    await actions.handleSend();

    expect(beginOptimisticSession).toHaveBeenCalledWith({ prompt: 'hello' });
    expect(setPendingTaskCreationId).toHaveBeenCalledWith('pending-1');
    expect(openDrawer).toHaveBeenCalled();
    expect(createTask).toHaveBeenCalledWith({
      cwd: '/repo',
      prompt: 'hello',
      taskBranchName: 'feature/task-1',
      reviewMergePolicy: 'merge_to_base',
      dependencyTaskIds: ['task-2'],
    });
    expect(promoteOptimisticSession).toHaveBeenCalledWith('pending-1', {
      taskId: 'task-1',
      sessionId: 'session-1',
    });
    expect(selectTask).toHaveBeenCalledWith('task-1');
    expect(clearDraft).toHaveBeenCalled();
    expect(exitPlanRevisionMode).toHaveBeenCalled();
    expect(setBootError).toHaveBeenCalledWith(null);
  });

  it('enters plan revision mode without transitioning when requested', async () => {
    const enterPlanRevisionMode = vi.fn();
    const transitionLifecycle = vi.fn();
    const setCwd = vi.fn();
    const setBootError = vi.fn();
    const actions = createChatPanelCommandActions(
      {
        cwd: '/repo',
        setCwd,
        sendMode: 'send_message',
        activeTaskId: 'task-1',
        reviewMergePolicy: 'merge_to_base',
        beginOptimisticSession: vi.fn(),
        setPendingTaskCreationId: vi.fn(),
        openDrawer: vi.fn(),
        promoteOptimisticSession: vi.fn(),
        selectTask: vi.fn(),
        appendOptimisticUserEvent: vi.fn(),
        clearDraft: vi.fn(),
        exitPlanRevisionMode: vi.fn(),
        discardOptimisticSession: vi.fn(),
        createApprovalResolvedEvents: vi.fn(() => []),
        appendLocalEvent: vi.fn(),
        createAbortEvent: vi.fn(),
        shouldEnterPlanRevisionMode: vi.fn(() => true),
        enterPlanRevisionMode,
        createRetryEvent: vi.fn(),
        setBootError,
      },
      {
        selectDirectory: vi.fn(),
        openWindow: vi.fn(),
        createTask: vi.fn(),
        transitionLifecycle,
        sendMessage: vi.fn(),
        resumeTask: vi.fn(),
        abortTask: vi.fn(),
      },
    );

    await actions.handleTaskLifecycleAction({ nextState: 'planning' });

    expect(enterPlanRevisionMode).toHaveBeenCalled();
    expect(transitionLifecycle).not.toHaveBeenCalled();
    expect(setBootError).toHaveBeenCalledWith(null);
  });

  it('resumes a task for retry actions without transitioning lifecycle', async () => {
    const appendLocalEvent = vi.fn();
    const resumeTask = vi.fn().mockResolvedValue(undefined);
    const transitionLifecycle = vi.fn();
    const setCwd = vi.fn();
    const setBootError = vi.fn();
    const actions = createChatPanelCommandActions(
      {
        cwd: '/repo',
        setCwd,
        sendMode: 'send_message',
        activeTaskId: 'task-1',
        reviewMergePolicy: 'merge_to_base',
        beginOptimisticSession: vi.fn(),
        setPendingTaskCreationId: vi.fn(),
        openDrawer: vi.fn(),
        promoteOptimisticSession: vi.fn(),
        selectTask: vi.fn(),
        appendOptimisticUserEvent: vi.fn(),
        clearDraft: vi.fn(),
        exitPlanRevisionMode: vi.fn(),
        discardOptimisticSession: vi.fn(),
        createApprovalResolvedEvents: vi.fn(() => []),
        appendLocalEvent,
        createAbortEvent: vi.fn(),
        shouldEnterPlanRevisionMode: vi.fn(() => false),
        enterPlanRevisionMode: vi.fn(),
        createRetryEvent: vi.fn(() => ({ type: 'taskStateChanged' })),
        setBootError,
      },
      {
        selectDirectory: vi.fn(),
        openWindow: vi.fn(),
        createTask: vi.fn(),
        transitionLifecycle,
        sendMessage: vi.fn(),
        resumeTask,
        abortTask: vi.fn(),
      },
    );

    await actions.handleTaskLifecycleAction({
      key: 'retry-error',
      nextState: 'executing',
    });

    expect(appendLocalEvent).toHaveBeenCalledWith('task-1', {
      type: 'taskStateChanged',
    });
    expect(resumeTask).toHaveBeenCalledWith({
      taskId: 'task-1',
      reason: 'resume',
    });
    expect(transitionLifecycle).not.toHaveBeenCalled();
    expect(setBootError).toHaveBeenCalledWith(null);
  });

  it('updates cwd when a directory is chosen', async () => {
    const setCwd = vi.fn();
    const setBootError = vi.fn();
    const selectDirectory = vi.fn().mockResolvedValue({ path: '/next' });
    const actions = createChatPanelCommandActions(
      {
        cwd: '/repo',
        setCwd,
        activeTaskCwd: '/repo/task',
        sendMode: 'send_message',
        reviewMergePolicy: 'merge_to_base',
        beginOptimisticSession: vi.fn(),
        setPendingTaskCreationId: vi.fn(),
        openDrawer: vi.fn(),
        promoteOptimisticSession: vi.fn(),
        selectTask: vi.fn(),
        appendOptimisticUserEvent: vi.fn(),
        clearDraft: vi.fn(),
        exitPlanRevisionMode: vi.fn(),
        discardOptimisticSession: vi.fn(),
        createApprovalResolvedEvents: vi.fn(() => []),
        appendLocalEvent: vi.fn(),
        createAbortEvent: vi.fn(),
        shouldEnterPlanRevisionMode: vi.fn(() => false),
        enterPlanRevisionMode: vi.fn(),
        createRetryEvent: vi.fn(),
        setBootError,
      },
      {
        selectDirectory,
        openWindow: vi.fn(),
        createTask: vi.fn(),
        transitionLifecycle: vi.fn(),
        sendMessage: vi.fn(),
        resumeTask: vi.fn(),
        abortTask: vi.fn(),
      },
    );

    await actions.handleChooseDirectory();

    expect(selectDirectory).toHaveBeenCalledWith({ defaultPath: '/repo' });
    expect(setCwd).toHaveBeenCalledWith('/next');
    expect(setBootError).toHaveBeenCalledWith(null);
  });
});
