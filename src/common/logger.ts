import fs from 'node:fs/promises';

import { toError } from '@technobuddha/library';

export interface Logger {
  log: (message: string) => void;
  error: (error: unknown) => void;
  //warn?: (message: string) => void;
  //debug?: (message: string) => void;
  //info?: (message: string) => void;
}

function log(message: string): void {
  void fs.appendFile('/tmp/cmtd.log', `[cmtd] ${message}\n`, 'utf-8');
}

export const defaultLogger: Logger = {
  log,
  error: (error: unknown) => log(`ERROR: ${toError(error).message}`),
};
