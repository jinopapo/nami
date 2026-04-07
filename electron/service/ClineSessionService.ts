import os from 'node:os';
import path from 'node:path';

export const resolveClineDir = (): string => path.join(os.homedir(), '.cline');
