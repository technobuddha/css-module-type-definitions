import fs from 'node:fs/promises';

import { toError } from '@technobuddha/library';

export interface Logger {
  log: (message: string) => void;
  error: (error: unknown) => void;
}

export const defaultLogger: Logger = {
  log: (message: string) => void fs.appendFile('/tmp/cmtd.log', `[cmtd] ${message}\n`, 'utf-8'),
  error: (error: unknown) =>
    void fs.appendFile('/tmp/cmtd.log', `[cmtd] ERROR: ${toError(error).message}\n`, 'utf-8'),
};
