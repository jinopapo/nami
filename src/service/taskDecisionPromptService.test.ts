/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'src_service'. Dependency is of type 'src_service' */
import { describe, expect, it } from 'vitest';
import type { UiTask } from '../model/task';
import { taskDecisionPromptService } from './taskDecisionPromptService';

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
  mode:
    lifecycleState === 'executing' ||
    lifecycleState === 'awaiting_review' ||
    lifecycleState === 'completed'
      ? 'act'
      : 'plan',
  lifecycleState,
  runtimeState: 'running',
  workspaceStatus: 'ready',
  mergeStatus: 'idle',
});

describe('taskDecisionPromptService', () => {
  it('shows inline decision prompt before planning starts', () => {
    expect(
      taskDecisionPromptService.shouldShowInlineDecisionPrompt(
        createTask('before_start'),
      ),
    ).toBe(true);
  });

  it('shows inline decision prompt while awaiting confirmation', () => {
    expect(
      taskDecisionPromptService.shouldShowInlineDecisionPrompt(
        createTask('awaiting_confirmation'),
      ),
    ).toBe(true);
  });

  it('does not show inline decision prompt in other states', () => {
    expect(
      taskDecisionPromptService.shouldShowInlineDecisionPrompt(
        createTask('planning'),
      ),
    ).toBe(false);
    expect(
      taskDecisionPromptService.shouldShowInlineDecisionPrompt(
        createTask('executing'),
      ),
    ).toBe(false);
    expect(
      taskDecisionPromptService.shouldShowInlineDecisionPrompt(
        createTask('awaiting_review'),
      ),
    ).toBe(false);
    expect(
      taskDecisionPromptService.shouldShowInlineDecisionPrompt(
        createTask('completed'),
      ),
    ).toBe(false);
  });
});
