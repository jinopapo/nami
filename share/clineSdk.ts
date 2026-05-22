type ClineSdkToolKind =
  | 'read'
  | 'edit'
  | 'delete'
  | 'move'
  | 'search'
  | 'execute'
  | 'think'
  | 'fetch'
  | 'switch_mode'
  | 'other';

export type ClineSdkSessionUpdate =
  | {
      sessionUpdate: 'agent_message_chunk';
      content: { type: 'text' | 'reasoning'; text: string };
      text?: string;
    }
  | {
      sessionUpdate: 'agent_thought_chunk';
      content: { type: 'reasoning'; text: string };
      text?: string;
    }
  | {
      sessionUpdate: 'tool_call' | 'tool_call_update';
      toolCallId?: string;
      kind?: ClineSdkToolKind | string | null;
      title?: string | null;
      status?: string | null;
      rawInput?: unknown;
      rawOutput?: unknown;
      content?: unknown[];
      locations?: unknown[];
    }
  | {
      sessionUpdate: 'plan';
      entries?: Array<{ content: string; status?: string }>;
      content?: unknown;
    }
  | {
      sessionUpdate: 'current_mode_update';
      currentModeId: 'plan' | 'act';
    }
  | {
      sessionUpdate:
        | 'user_message_chunk'
        | 'available_commands_update'
        | 'config_option_update'
        | 'session_info_update';
      [key: string]: unknown;
    };

export type ClineSdkPermissionRequest = {
  sessionId: string;
  toolName: string;
  input: unknown;
  title: string;
  options: Array<{
    optionId: 'allow_once' | 'reject_once' | string;
    kind: 'allow' | 'reject' | string;
    name: string;
  }>;
};
