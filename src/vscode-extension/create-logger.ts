import { empty, toError } from '@technobuddha/library';
import { window } from 'vscode';

import { type Logger } from '../common/index.ts';

export function createLogger(): Logger {
  const outputChannel = window.createOutputChannel('CMTD'); //, { log: true });

  outputChannel.clear();

  return {
    trace: (...message: string[]) => outputChannel.appendLine(message.join(empty)),
    debug: (...message: string[]) => outputChannel.appendLine(message.join(empty)),
    info: (...message: string[]) => outputChannel.appendLine(message.join(empty)),
    warn: (...message: string[]) => outputChannel.appendLine(message.join(empty)),
    error: (error: Error | string, ...message: string[]) =>
      outputChannel.appendLine([toError(error).message, ...message].join(empty)),
  };
}
