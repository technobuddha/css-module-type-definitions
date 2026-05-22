import { type ExtensionContext, window } from 'vscode';

import {
  commandDeleteTypes,
  commandHideTypeFiles,
  commandShowTypeFiles,
  commandUpdateTypes,
} from './commands/index.ts';
import { ConfigurationController } from './controllers/configuration-controller.ts';
import { FileWatcherController } from './controllers/file-watcher-controller.ts';

export const config = new ConfigurationController();

export async function activate(context: ExtensionContext): Promise<void> {
  window.showInformationMessage('css-module-type-definitions is now activating');

  await config.init();
  const watcher = await FileWatcherController.create();
  context.subscriptions.push(
    config,
    watcher,
    commandDeleteTypes(),
    commandUpdateTypes(),
    commandShowTypeFiles(),
    commandHideTypeFiles(),
  );
}

export function deactivate(): void {
  // empty
}
