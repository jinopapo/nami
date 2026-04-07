import type { SessionUpdate } from 'cline';

const ACP_EVENTS = [
  'user_message_chunk',
  'agent_message_chunk',
  'agent_thought_chunk',
  'tool_call',
  'tool_call_update',
  'plan',
  'available_commands_update',
  'current_mode_update',
  'config_option_update',
  'session_info_update',
] as const;

export type ToolCallSessionUpdate = Extract<
  SessionUpdate,
  { sessionUpdate: 'tool_call' | 'tool_call_update' }
>;

export class ClineSessionEventService {
  private readonly attachedSessionListeners = new Set<string>();

  attachSessionListenersOnce(input: {
    sessionId: string;
    emitter: {
      on: (name: string, listener: (payload: unknown) => void) => void;
    };
    onSessionUpdate: (
      name: (typeof ACP_EVENTS)[number],
      update: SessionUpdate,
    ) => void;
    onError: (error: Error) => void;
  }): void {
    if (this.attachedSessionListeners.has(input.sessionId)) {
      return;
    }

    for (const name of ACP_EVENTS) {
      input.emitter.on(name, (update: unknown) => {
        input.onSessionUpdate(name, {
          ...(update as Record<string, unknown>),
          sessionUpdate: name,
        } as SessionUpdate);
      });
    }

    input.emitter.on('error', (error: unknown) => {
      input.onError(error instanceof Error ? error : new Error(String(error)));
    });

    this.attachedSessionListeners.add(input.sessionId);
  }
}
