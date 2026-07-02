import { type ExtensionContext, languages, window } from 'vscode';

import {
  commandDeleteTypes,
  commandHideTypeFiles,
  commandShowTypeFiles,
  commandUpdateTypes,
} from './commands/index.ts';
import { WorkspaceController } from './controllers/workspace-controller.ts';
import { CMTDHoverProvider } from './providers/index.ts';

const codeSelector = [
  { scheme: 'file', language: 'typescriptreact' },
  { scheme: 'file', language: 'javascriptreact' },
  { scheme: 'file', language: 'typescript' },
  { scheme: 'file', language: 'javascript' },
];

export async function activate(context: ExtensionContext): Promise<void> {
  window.showInformationMessage('css-module-type-definitions is now activating');

  const controller = await WorkspaceController.create();

  context.subscriptions.push(
    controller,
    commandDeleteTypes({ controller }),
    commandUpdateTypes({ controller }),
    commandShowTypeFiles({ controller }),
    commandHideTypeFiles({ controller }),

    languages.registerHoverProvider(
      codeSelector,
      new CMTDHoverProvider({ options: controller, logger: controller }),
    ),
  );
}

export function deactivate(): void {
  // empty
}
