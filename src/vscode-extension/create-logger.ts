import { empty, toError } from '@technobuddha/library';
import { window } from 'vscode';

import { type Logger } from '../common/index.ts';

export function createLogger(): Logger {
  const outputChannel = window.createOutputChannel('CMTD', { log: true });

  return {
    trace: (...message: string[]) => outputChannel.trace(message.join(empty)),
    debug: (...message: string[]) => outputChannel.debug(message.join(empty)),
    info: (...message: string[]) => outputChannel.info(message.join(empty)),
    warn: (...message: string[]) => outputChannel.warn(message.join(empty)),
    error: (error: Error | string, ...message: string[]) =>
      outputChannel.error([toError(error).message, ...message].join(empty)),
  };
}
