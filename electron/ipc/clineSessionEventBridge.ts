import type { ServiceEvent } from '../../core/clineSessionOrchestratorEvent.js';
import {
  ClineSessionEventService,
  type ToolCallSessionUpdate,
} from '../service/ClineSessionEventService.js';
import { ClineTaskRuntimeService } from '../service/ClineTaskRuntimeService.js';
import { ToolCallLogService } from '../service/ToolCallLogService.js';

type EmitEvent = (event: ServiceEvent) => void;

export class ClineSessionEventBridge {
  constructor(
    private readonly eventService: ClineSessionEventService,
    private readonly runtimeService: ClineTaskRuntimeService,
    private readonly toolCallLogService: ToolCallLogService,
    private readonly emit: EmitEvent,
  ) {}

  attachSessionListenersOnce(input: {
    sessionId: string;
    emitter: {
      on: (name: string, listener: (payload: unknown) => void) => void;
    };
    syncTaskModeWithLifecycle: (taskId: string, mode: 'plan' | 'act') => void;
  }): void {
    this.eventService.attachSessionListenersOnce({
      sessionId: input.sessionId,
      emitter: input.emitter,
      onSessionUpdate: (name, update) => {
        const taskId = this.runtimeService.findTaskIdBySession(input.sessionId);
        if (!taskId) return;

        if (name === 'current_mode_update') {
          const nextMode = (update as { currentModeId?: unknown })
            .currentModeId;
          if (nextMode === 'plan' || nextMode === 'act') {
            input.syncTaskModeWithLifecycle(taskId, nextMode);
          }
        }

        if (name === 'tool_call' || name === 'tool_call_update') {
          void this.toolCallLogService.log({
            taskId,
            sessionId: input.sessionId,
            turnId: this.runtimeService.getTask(taskId).activeTurnId,
            update: update as ToolCallSessionUpdate,
          });
        }

        this.emit({
          type: 'session-update',
          taskId,
          sessionId: input.sessionId,
          turnId: this.runtimeService.getTask(taskId).activeTurnId,
          update,
        });
      },
      onError: (error) => {
        const taskId = this.runtimeService.findTaskIdBySession(input.sessionId);
        if (taskId) {
          this.runtimeService.updateRuntimeState(
            taskId,
            'error',
            error.message,
          );
        }
        this.emit({
          type: 'error',
          taskId,
          sessionId: input.sessionId,
          message: error.message,
        });
      },
    });
  }
}
