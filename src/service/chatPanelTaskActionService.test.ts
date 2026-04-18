import { describe, expect, it } from 'vitest';
import type { UiTask } from '../model/chat';
import { chatPanelTaskActionService } from './chatPanelTaskActionService';

const createTask = (lifecycleState: UiTask['lifecycleState']): UiTask => ({
  taskId: 'task-1',
  sessionId: 'session-1',
  cwd: '/tmp',
  projectWorkspacePath: '/project',
  taskWorkspacePath: '/project/.worktrees/task-1',
  taskBranchName: 'task/task-1',
  baseBranchName: 'main',
  createdAt: '2026-03-18T00:00:00.000Z',
  updatedAt: '2026-03-18T00:00:00.000Z',
  mode: lifecycleState === 'awaiting_review' ? 'act' : 'plan',
  lifecycleState,
  runtimeState: 'running',
  workspaceStatus: 'ready',
  mergeStatus: 'idle',
});

describe('chatPanelTaskActionService', () => {
  it('normalizes prompt text and resolves send mode', () => {
    expect(chatPanelTaskActionService.getPrompt('  hello  ')).toBe('hello');
    expect(chatPanelTaskActionService.getPrompt('   ')).toBeUndefined();

    expect(
      chatPanelTaskActionService.resolveSendMode(undefined, undefined, false),
    ).toBe('create');
    expect(
      chatPanelTaskActionService.resolveSendMode(
        'task-1',
        createTask('awaiting_confirmation'),
        true,
      ),
    ).toBe('revise_plan');
    expect(
      chatPanelTaskActionService.resolveSendMode(
        'task-1',
        createTask('executing'),
        false,
      ),
    ).toBe('send_message');
  });

  it('creates optimistic approval and abort events', () => {
    const approvalEvents =
      chatPanelTaskActionService.createApprovalResolvedEvents({
        taskId: 'task-1',
        sessionId: 'session-1',
        approvalId: 'approval-1',
        decision: 'approve',
      });
    const abortEvent = chatPanelTaskActionService.createAbortEvent({
      taskId: 'task-1',
      sessionId: 'session-1',
    });

    expect(approvalEvents).toHaveLength(2);
    expect(approvalEvents[0]).toMatchObject({
      type: 'permissionResponse',
      approvalId: 'approval-1',
      decision: 'approve',
    });
    expect(approvalEvents[1]).toMatchObject({
      type: 'taskStateChanged',
      state: 'running',
      reason: 'permission_resolved',
    });
    expect(abortEvent).toMatchObject({ type: 'abort', taskId: 'task-1' });
  });

  it('detects when planning should switch to revision mode', () => {
    expect(
      chatPanelTaskActionService.shouldEnterPlanRevisionMode(
        'awaiting_confirmation',
        'planning',
      ),
    ).toBe(true);
    expect(
      chatPanelTaskActionService.shouldEnterPlanRevisionMode(
        'executing',
        'planning',
      ),
    ).toBe(false);
  });
});
