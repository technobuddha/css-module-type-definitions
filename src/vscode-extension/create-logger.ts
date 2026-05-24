import { toError, wait } from '@technobuddha/library';
import { commands, LogLevel, type LogOutputChannel, window } from 'vscode';

import { type Logger } from '../common/index.ts';

async function activateOutputChannel(outputChannel: LogOutputChannel): Promise<void> {
  outputChannel.show(false);
  await wait();
  await wait();
}

async function setActiveOutputDebugLevel(outputChannel: LogOutputChannel): Promise<void> {
  await activateOutputChannel(outputChannel);

  const command = `workbench.action.output.activeOutputLogLevel.${LogLevel.Debug}`;
  try {
    await commands.executeCommand(command);
  } catch {
    // Ignore command failures on unsupported VS Code builds.
  }

  await wait();
  await wait();
}

export async function createLogger(): Promise<Logger> {
  const outputChannel = window.createOutputChannel('CMTD', { log: true });
  outputChannel.show(false);

  await setActiveOutputDebugLevel(outputChannel);

  if (outputChannel.logLevel !== LogLevel.Debug) {
    await wait();
    await setActiveOutputDebugLevel(outputChannel);
  }

  return {
    trace: (message) => outputChannel.trace(message),
    debug: (message) => outputChannel.debug(message),
    info: (message) => outputChannel.info(message),
    warn: (message) => outputChannel.warn(message),
    error: (message) => outputChannel.error(toError(message).message),
  };
}
