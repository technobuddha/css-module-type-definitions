import fs from 'node:fs/promises';

import { toError } from '@technobuddha/library';

export interface Logger {
  trace: (message: string) => void;
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (error: string | Error) => void;
}

function output(message: string): void {
  void fs.appendFile('/tmp/cmtd.log', `${message}\n`, 'utf-8');
}

export const defaultLogger: Logger = {
  trace: output,
  debug: output,
  info: output,
  warn: (message: string) => output(`WARN: ${message}`),
  error: (error: string | Error) => output(`ERROR: ${toError(error).message}`),
};
