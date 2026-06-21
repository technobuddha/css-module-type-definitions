import { type ExtensionContext, window } from 'vscode';

import {
  commandDeleteTypes,
  commandHideTypeFiles,
  commandShowTypeFiles,
  commandUpdateTypes,
} from './commands/index.ts';
import { WorkspaceController } from './controllers/workspace-controller.ts';

export async function activate(context: ExtensionContext): Promise<void> {
  window.showInformationMessage('css-module-type-definitions is now activating');

  const controller = await WorkspaceController.create();

  context.subscriptions.push(
    controller,
    commandDeleteTypes({ controller }),
    commandUpdateTypes({ controller }),
    commandShowTypeFiles({ controller }),
    commandHideTypeFiles({ controller }),
  );
}

export function deactivate(): void {
  // empty
}
