import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const appendToolCallLogEntry = async (
  logFilePath: string,
  entry: Record<string, unknown>,
): Promise<void> => {
  await mkdir(path.dirname(logFilePath), { recursive: true });
  await appendFile(logFilePath, `${JSON.stringify(entry)}\n`, 'utf8');
};
