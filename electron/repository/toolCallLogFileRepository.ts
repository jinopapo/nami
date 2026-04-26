import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const append = async (
  logFilePath: string,
  entry: Record<string, unknown>,
): Promise<void> => {
  await mkdir(path.dirname(logFilePath), { recursive: true });
  await appendFile(logFilePath, `${JSON.stringify(entry)}\n`, 'utf8');
};

// eslint-disable-next-line no-grouped-exports/no-exported-function-object -- Existing service object; clean up separately.
export const toolCallLogFileRepository = {
  append,
};
