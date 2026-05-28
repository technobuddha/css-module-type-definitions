import { toError } from '@technobuddha/library';
import { window } from 'vscode';

import { type Logger } from '../common/index.ts';

export async function createLogger(): Promise<Logger> {
  const outputChannel = window.createOutputChannel('CMTD', { log: true });

  return {
    trace: (message) => outputChannel.trace(message),
    debug: (message) => outputChannel.debug(message),
    info: (message) => outputChannel.info(message),
    warn: (message) => outputChannel.warn(message),
    error: (message) => outputChannel.error(toError(message).message),
  };
}
