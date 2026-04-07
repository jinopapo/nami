import path from 'node:path';
import { toolCallLogFileRepository } from '../repository/toolCallLogFileRepository.js';
import { toolCallLogRepository } from '../repository/toolCallLogRepository.js';
import type { ToolCallSessionUpdate } from './ClineSessionEventService.js';

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
    const toolLog = toolCallLogRepository.createToolCallLog(input.update);
    const entry = {
      timestamp: new Date().toISOString(),
      taskId: input.taskId,
      sessionId: input.sessionId,
      turnId: input.turnId,
      ...toolLog,
    };
    console.log('[tool-call-log]', entry);
    try {
      await toolCallLogFileRepository.append(this.logFilePath, entry);
    } catch (error) {
      console.error('[tool-call-log] Failed to persist tool call log', {
        logFilePath: this.logFilePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
