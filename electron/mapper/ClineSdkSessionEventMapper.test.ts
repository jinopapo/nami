/* eslint-disable boundaries/element-types -- No rule allowing this dependency was found. File is of type 'electron_mapper'. Dependency is of type 'electron_mapper' */
import { describe, expect, it } from 'vitest';
import type { ClineSdkCoreSessionEventResource } from '../resource/clineSdkSession.js';
import {
  extractClineSdkSessionId,
  mapCoreSessionEvent,
  mapFinishReasonToStopReason,
  mapToolApprovalRequestToPermissionRequest,
  mapToolNameToToolKind,
} from './ClineSdkSessionEventMapper.js';

describe('mapToolNameToToolKind', () => {
  it('maps Cline SDK built-in tool names to UI tool kinds', () => {
    expect(mapToolNameToToolKind('read_files')).toBe('read');
    expect(mapToolNameToToolKind('editor')).toBe('edit');
    expect(mapToolNameToToolKind('apply_patch')).toBe('edit');
    expect(mapToolNameToToolKind('bash')).toBe('execute');
    expect(mapToolNameToToolKind('search')).toBe('search');
    expect(mapToolNameToToolKind('fetch_web')).toBe('fetch');
    expect(mapToolNameToToolKind('unknown')).toBe('other');
  });
});

describe('mapFinishReasonToStopReason', () => {
  it('normalizes aborted to cancelled', () => {
    expect(mapFinishReasonToStopReason('aborted')).toBe('cancelled');
    expect(mapFinishReasonToStopReason('completed')).toBe('completed');
  });
});

describe('mapToolApprovalRequestToPermissionRequest', () => {
  it('maps Cline SDK tool approval request to app permission request', () => {
    expect(
      mapToolApprovalRequestToPermissionRequest({
        sessionId: 'session-1',
        toolName: 'bash',
        input: { command: 'npm test' },
      }),
    ).toEqual({
      sessionId: 'session-1',
      toolName: 'bash',
      input: { command: 'npm test' },
      title: 'bash の実行許可',
      options: [
        { optionId: 'allow_once', kind: 'allow', name: '許可' },
        { optionId: 'reject_once', kind: 'reject', name: '拒否' },
      ],
    });
  });
});

describe('extractClineSdkSessionId', () => {
  it('extracts sessionId from Cline SDK event payload', () => {
    expect(
      extractClineSdkSessionId({
        type: 'ended',
        payload: { sessionId: 'session-1', reason: 'completed', ts: 1 },
      }),
    ).toBe('session-1');
  });
});

describe('mapCoreSessionEvent', () => {
  it('maps ClineCore stream agent chunk to assistant text chunk', () => {
    expect(
      mapCoreSessionEvent({
        type: 'chunk',
        payload: {
          sessionId: 'session-1',
          stream: 'agent',
          chunk: 'hello',
          ts: 1,
        },
      }),
    ).toEqual({
      type: 'session-update',
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'hello' },
        text: 'hello',
      },
    });
  });

  it('extracts text content from ClineCore stream agent JSON lines chunk', () => {
    expect(
      mapCoreSessionEvent({
        type: 'chunk',
        payload: {
          sessionId: 'session-1',
          stream: 'agent',
          chunk: [
            '{"type":"iteration_start","iteration":1}',
            '{"type":"content_start","contentType":"text","text":"pong","accumulated":"pong"}',
            '{"type":"usage","inputTokens":1536,"outputTokens":5}',
            '{"type":"content_end","contentType":"text","text":"pong"}',
            '{"type":"iteration_end","iteration":1,"hadToolCalls":false}',
            '{"type":"done","reason":"completed","text":"pong"}',
          ].join('\n'),
          ts: 1,
        },
      }),
    ).toEqual({
      type: 'session-update',
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'pong' },
        text: 'pong',
      },
    });
  });

  it('maps ClineCore text chunk to assistant text chunk', () => {
    expect(
      mapCoreSessionEvent({
        type: 'chunk',
        payload: {
          sessionId: 'session-1',
          type: 'text',
          text: 'hello',
        },
      }),
    ).toEqual({
      type: 'session-update',
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'hello' },
        text: 'hello',
      },
    });
  });

  it('maps ClineCore reasoning chunk to assistant thought chunk', () => {
    expect(
      mapCoreSessionEvent({
        type: 'chunk',
        payload: {
          sessionId: 'session-1',
          type: 'reasoning',
          text: 'thinking',
        },
      }),
    ).toEqual({
      type: 'session-update',
      update: {
        sessionUpdate: 'agent_thought_chunk',
        content: { type: 'reasoning', text: 'thinking' },
        text: 'thinking',
      },
    });
  });

  it('does not map ClineCore legacy agent text events as chat text', () => {
    expect(
      mapCoreSessionEvent({
        type: 'agent_event',
        payload: {
          sessionId: 'session-1',
          event: {
            type: 'content_start',
            contentType: 'text',
            text: 'test',
            accumulated: 'test',
          },
        },
      } as ClineSdkCoreSessionEventResource),
    ).toBeUndefined();

    expect(
      mapCoreSessionEvent({
        type: 'agent_event',
        payload: {
          sessionId: 'session-1',
          event: {
            type: 'done',
            reason: 'completed',
            text: 'test',
          },
        },
      } as ClineSdkCoreSessionEventResource),
    ).toBeUndefined();
  });

  it('maps tool lifecycle events to tool_call updates', () => {
    expect(
      mapCoreSessionEvent({
        type: 'agent_event',
        payload: {
          sessionId: 'session-1',
          event: {
            type: 'tool-started',
            toolCall: {
              toolCallId: 'tool-1',
              toolName: 'bash',
              input: { command: 'npm test' },
            },
          },
        },
      } as ClineSdkCoreSessionEventResource),
    ).toEqual({
      type: 'session-update',
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'tool-1',
        kind: 'execute',
        title: 'bash',
        status: 'processing',
        rawInput: { command: 'npm test' },
      },
    });

    expect(
      mapCoreSessionEvent({
        type: 'agent_event',
        payload: {
          sessionId: 'session-1',
          event: {
            type: 'tool-finished',
            toolCall: {
              toolCallId: 'tool-1',
              toolName: 'bash',
              input: { command: 'npm test' },
            },
            message: {
              content: [
                {
                  type: 'tool-result',
                  output: { exitCode: 0, stdout: 'ok' },
                },
              ],
            },
          },
        },
      } as ClineSdkCoreSessionEventResource),
    ).toEqual({
      type: 'session-update',
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'tool-1',
        kind: 'execute',
        title: 'bash',
        status: 'completed',
        rawInput: { command: 'npm test' },
        rawOutput: { exitCode: 0, stdout: 'ok' },
      },
    });
  });

  it('maps ended event to session-ended', () => {
    expect(
      mapCoreSessionEvent({
        type: 'ended',
        payload: { sessionId: 'session-1', finishReason: 'aborted' },
      }),
    ).toEqual({ type: 'session-ended', stopReason: 'cancelled' });
  });

  it('maps current ClineCore ended reason to session-ended', () => {
    expect(
      mapCoreSessionEvent({
        type: 'ended',
        payload: { sessionId: 'session-1', reason: 'completed', ts: 1 },
      }),
    ).toEqual({ type: 'session-ended', stopReason: 'completed' });
  });

  it('maps run finished finishReason to session-ended', () => {
    expect(
      mapCoreSessionEvent({
        type: 'agent_event',
        payload: {
          sessionId: 'session-1',
          event: {
            type: 'run-finished',
            result: { finishReason: 'completed' },
          },
        },
      } as ClineSdkCoreSessionEventResource),
    ).toEqual({ type: 'session-ended', stopReason: 'completed' });
  });

  it('keeps run failure details in session-ended event', () => {
    expect(
      mapCoreSessionEvent({
        type: 'agent_event',
        payload: {
          sessionId: 'session-1',
          event: {
            type: 'run-failed',
            error: { message: 'provider authentication failed' },
          },
        },
      } as ClineSdkCoreSessionEventResource),
    ).toEqual({
      type: 'session-ended',
      stopReason: 'error',
      error: 'provider authentication failed',
    });
  });
});
