/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_service' | No rule allowing this dependency was found. File is of type 'electron_service'. Dependency is of type 'electron_ipc' */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  agentInstances,
  createUserDataPath,
  resetClineTestState,
  waitForAsyncWork,
  waitUntil,
} from './ClineSessionService.testHelper.js';
import { ClineSessionOrchestrator } from '../ipc/clineSessionOrchestrator.js';

describe('ClineSessionOrchestrator mode sync', () => {
  const originalClineDir = process.env.CLINE_DIR;

  afterEach(() => {
    resetClineTestState(originalClineDir);
  });

  it('does not call setSessionMode before sendMessage when the session is already plan', async () => {
    const userDataPath = await createUserDataPath(
      'send-message-plan-no-mode-set',
    );
    const service = new ClineSessionOrchestrator(userDataPath);
    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'end_turn' })
      .mockResolvedValueOnce({ stopReason: 'completed' });

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    await service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitUntil(() => {
      expect(
        service['runtimeService'].getTask(task.taskId).lifecycleState,
      ).toBe('awaiting_confirmation');
    });

    await service.sendMessage({
      taskId: task.taskId,
      prompt: '補足の計画を出して',
    });
    await waitUntil(() => {
      expect(agentInstances[0]?.prompt).toHaveBeenNthCalledWith(2, {
        sessionId: 'new-session-2',
        prompt: [{ type: 'text', text: '補足の計画を出して' }],
      });
    });

    expect(agentInstances[0]?.setSessionMode).not.toHaveBeenCalled();
  });

  it('waits for async mode correction before sendMessage prompt and avoids duplicate mode set', async () => {
    const userDataPath = await createUserDataPath(
      'send-message-await-mode-correction',
    );
    const service = new ClineSessionOrchestrator(userDataPath);
    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'end_turn' })
      .mockResolvedValueOnce({ stopReason: 'completed' });

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    await service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitUntil(() => {
      expect(
        service['runtimeService'].getTask(task.taskId).lifecycleState,
      ).toBe('awaiting_confirmation');
    });

    const emitter = agentInstances[0]?.emitterForSession.mock.results[1]
      ?.value as { on: ReturnType<typeof vi.fn> };
    const currentModeCall = [...emitter.on.mock.calls]
      .reverse()
      .find((call) => call[0] === 'current_mode_update');
    const currentModeListener = currentModeCall?.[1] as
      | ((update: unknown) => void)
      | undefined;

    agentInstances[0]?.sessions.set('new-session-2', {
      ...agentInstances[0]?.sessions.get('new-session-2'),
      sessionId: 'new-session-2',
      cwd: '/tmp',
      mode: 'act',
      mcpServers: [],
      createdAt: Date.parse('2026-03-19T00:00:00.000Z'),
      lastActivityAt: Date.parse('2026-03-19T00:00:00.000Z'),
    });

    let resolveModeCorrection: (() => void) | undefined;
    const delayedModeCorrection = new Promise<unknown>((resolve) => {
      resolveModeCorrection = () => {
        agentInstances[0]?.sessions.set('new-session-2', {
          ...agentInstances[0]?.sessions.get('new-session-2'),
          sessionId: 'new-session-2',
          cwd: '/tmp',
          mode: 'plan',
          mcpServers: [],
          createdAt: Date.parse('2026-03-19T00:00:00.000Z'),
          lastActivityAt: Date.parse('2026-03-19T00:00:00.000Z'),
        });
        resolve({});
      };
    });
    agentInstances[0]?.setSessionMode.mockImplementationOnce(
      () => delayedModeCorrection,
    );

    currentModeListener?.({ currentModeId: 'act' });

    await service.sendMessage({
      taskId: task.taskId,
      prompt: '補足の計画を出して',
    });

    await waitForAsyncWork();
    expect(agentInstances[0]?.setSessionMode).toHaveBeenCalledTimes(1);
    expect(agentInstances[0]?.prompt).toHaveBeenCalledTimes(1);

    resolveModeCorrection?.();

    await waitUntil(() => {
      expect(agentInstances[0]?.prompt).toHaveBeenNthCalledWith(2, {
        sessionId: 'new-session-2',
        prompt: [{ type: 'text', text: '補足の計画を出して' }],
      });
    });

    expect(agentInstances[0]?.setSessionMode).toHaveBeenCalledTimes(1);
  });

  it('does not run a cancelled turn when cancellation happens while mode correction is pending', async () => {
    const userDataPath = await createUserDataPath(
      'send-message-cancel-during-mode-correction',
    );
    const service = new ClineSessionOrchestrator(userDataPath);
    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'end_turn' })
      .mockResolvedValueOnce({ stopReason: 'completed' });

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    await service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitUntil(() => {
      expect(
        service['runtimeService'].getTask(task.taskId).lifecycleState,
      ).toBe('awaiting_confirmation');
    });

    agentInstances[0]?.sessions.set('new-session-2', {
      ...agentInstances[0]?.sessions.get('new-session-2'),
      sessionId: 'new-session-2',
      cwd: '/tmp',
      mode: 'act',
      mcpServers: [],
      createdAt: Date.parse('2026-03-19T00:00:00.000Z'),
      lastActivityAt: Date.parse('2026-03-19T00:00:00.000Z'),
    });

    let resolveModeCorrection: (() => void) | undefined;
    const delayedModeCorrection = new Promise<unknown>((resolve) => {
      resolveModeCorrection = () => {
        agentInstances[0]?.sessions.set('new-session-2', {
          ...agentInstances[0]?.sessions.get('new-session-2'),
          sessionId: 'new-session-2',
          cwd: '/tmp',
          mode: 'plan',
          mcpServers: [],
          createdAt: Date.parse('2026-03-19T00:00:00.000Z'),
          lastActivityAt: Date.parse('2026-03-19T00:00:00.000Z'),
        });
        resolve({});
      };
    });
    agentInstances[0]?.setSessionMode.mockImplementationOnce(
      () => delayedModeCorrection,
    );

    await service.sendMessage({
      taskId: task.taskId,
      prompt: '補足の計画を出して',
    });
    await waitForAsyncWork();
    expect(agentInstances[0]?.setSessionMode).toHaveBeenCalledTimes(1);

    await service.abortTask(task.taskId);
    resolveModeCorrection?.();

    await waitForAsyncWork();
    expect(agentInstances[0]?.prompt).toHaveBeenCalledTimes(1);
  });

  it('uses latest expected mode when queued mode-sync runs after lifecycle changes', async () => {
    const userDataPath = await createUserDataPath(
      'queued-mode-sync-uses-latest-expected-mode',
    );
    const service = new ClineSessionOrchestrator(userDataPath);
    let resolveExecutionPrompt:
      | ((value: { stopReason: 'cancelled' }) => void)
      | undefined;
    agentInstances[0]?.prompt
      .mockResolvedValueOnce({ stopReason: 'end_turn' })
      .mockImplementationOnce(
        () =>
          new Promise<{ stopReason: 'cancelled' }>((resolve) => {
            resolveExecutionPrompt = resolve;
          }),
      );

    const task = await service.startTask({ cwd: '/tmp', prompt: 'plan this' });
    await service.transitionTaskLifecycle({
      taskId: task.taskId,
      nextState: 'planning',
    });
    await waitUntil(() => {
      expect(
        service['runtimeService'].getTask(task.taskId).lifecycleState,
      ).toBe('awaiting_confirmation');
    });

    await service.sendMessage({
      taskId: task.taskId,
      prompt: 'この内容で実装を進めて',
    });
    await waitUntil(() => {
      expect(resolveExecutionPrompt).toBeTypeOf('function');
    });

    const emitter = agentInstances[0]?.emitterForSession.mock.results[1]
      ?.value as { on: ReturnType<typeof vi.fn> };
    const currentModeCall = [...emitter.on.mock.calls]
      .reverse()
      .find((call) => call[0] === 'current_mode_update');
    const currentModeListener = currentModeCall?.[1] as
      | ((update: unknown) => void)
      | undefined;

    agentInstances[0]?.sessions.set('new-session-2', {
      ...agentInstances[0]?.sessions.get('new-session-2'),
      sessionId: 'new-session-2',
      cwd: '/tmp',
      mode: 'act',
      mcpServers: [],
      createdAt: Date.parse('2026-03-19T00:00:00.000Z'),
      lastActivityAt: Date.parse('2026-03-19T00:00:00.000Z'),
    });
    currentModeListener?.({ currentModeId: 'act' });

    service['runtimeService'].updateLifecycleState(
      task.taskId,
      'executing',
      'manual_test',
    );

    resolveExecutionPrompt?.({ stopReason: 'cancelled' });
    await waitForAsyncWork();

    expect(agentInstances[0]?.setSessionMode).not.toHaveBeenCalled();
  });
});
