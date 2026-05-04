import path from 'node:path';
import type { SessionUpdate } from 'cline';
import { appendToolCallLogEntry } from '../repository/toolCallLogFileRepository.js';
import { createToolCallLog } from '../repository/toolCallLogRepository.js';

type ToolCallSessionUpdate = Extract<
  SessionUpdate,
  { sessionUpdate: 'tool_call' | 'tool_call_update' }
>;

export class ToolCallLogService {
  private readonly logFilePath: string;

  constructor(userDataPath: string) {
    this.logFilePath = path.join(userDataPath, 'logs', 'tool-calls.jsonl');
  }

  async log(input: {
    taskId: string;
    sessionId: string;
    turnId?: string;
    update: ToolCallSessionUpdate;
  }): Promise<void> {
    const toolLog = createToolCallLog(input.update);
    const entry = {
      timestamp: new Date().toISOString(),
      taskId: input.taskId,
      sessionId: input.sessionId,
      turnId: input.turnId,
      ...toolLog,
    };
    console.log('[tool-call-log]', entry);
    try {
      await appendToolCallLogEntry(this.logFilePath, entry);
    } catch (error) {
      console.error('[tool-call-log] Failed to persist tool call log', {
        logFilePath: this.logFilePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
