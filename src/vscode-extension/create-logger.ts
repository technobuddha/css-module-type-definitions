import { window } from 'vscode';

import { type Logger } from '../common/index.ts';

export function createLogger(): Logger {
  const outputChannel = window.createOutputChannel('CTMD');
  outputChannel.show();

  return {
    log: (message) => outputChannel.appendLine(message),
    error: (message) => outputChannel.appendLine(`ERROR: ${message}`),
  };
}
