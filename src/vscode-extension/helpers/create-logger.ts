import { empty, space, toError } from '@technobuddha/library';
import { window } from 'vscode';

import { type Logger } from '../../common/index.ts';

export function createLogger(): Logger {
  const outputChannel = window.createOutputChannel('CMTD' /*, { log: true }*/);

  outputChannel.clear();
  outputChannel.show(true);

  // outputChannel.info('CMTD Logger Initialized');

  return {
    trace: (...message: string[]) => outputChannel.appendLine(stamped(message)),
    debug: (...message: string[]) => outputChannel.appendLine(stamped(message)),
    info: (...message: string[]) => outputChannel.appendLine(stamped(message)),
    warn: (...message: string[]) => outputChannel.appendLine(stamped(message)),
    error: (error: Error | string, ...message: string[]) =>
      outputChannel.appendLine(stamped([toError(error).message, ...message])),
  };
  //  return {
  //    trace: (...message: string[]) => outputChannel.trace(message.join(empty)),
  //    debug: (...message: string[]) => outputChannel.debug(message.join(empty)),
  //    info: (...message: string[]) => outputChannel.info(message.join(empty)),
  //    warn: (...message: string[]) => outputChannel.warn(message.join(empty)),
  //    error: (error: Error | string, ...message: string[]) =>
  //      outputChannel.error([toError(error).message, ...message].join(empty)),
  //  };
}

function stamped(message: string[]): string {
  return [new Date().toISOString().replaceAll(/[\-:T.Z]/gv, empty), space, ...message].join(empty);
}
