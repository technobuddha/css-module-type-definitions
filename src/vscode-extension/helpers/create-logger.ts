import { empty } from '@technobuddha/library';
import { type OutputChannel, window } from 'vscode';

import { type Logger } from '../../common/index.ts';

export function createLogger(): { outputChannel: OutputChannel } & Logger {
  const outputChannel = window.createOutputChannel('CMTD');

  outputChannel.clear();

  return {
    outputChannel,
    trace: (...message: string[]) => outputChannel.appendLine(message.join(empty)),
    debug: (...message: string[]) => outputChannel.appendLine(message.join(empty)),
    info: (...message: string[]) => outputChannel.appendLine(message.join(empty)),
    warn: (...message: string[]) => outputChannel.appendLine(message.join(empty)),
    error: (...message: string[]) => outputChannel.appendLine(message.join(empty)),
  };
}
