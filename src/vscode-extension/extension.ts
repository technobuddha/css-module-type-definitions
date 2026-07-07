import { commands, type ExtensionContext, languages, window } from 'vscode';

import {
  commandDeleteTypes,
  commandHideTypeFiles,
  commandShowTypeFiles,
  commandUpdateTypes,
} from './commands/index.ts';
import { WorkspaceController } from './controllers/index.ts';
import {
  CMTDDefinitionProvider,
  CMTDHoverProvider,
  CMTDSelectorsCompletionProvider,
  CSSReferenceProvider,
} from './providers/index.ts';

const codeSelector = [
  { scheme: 'file', language: 'typescriptreact' },
  { scheme: 'file', language: 'javascriptreact' },
  { scheme: 'file', language: 'typescript' },
  { scheme: 'file', language: 'javascript' },
];

export async function activate(context: ExtensionContext): Promise<void> {
  window.showInformationMessage('css-module-type-definitions is now activating');

  const workspaceController = await WorkspaceController.create();

  context.subscriptions.push(
    workspaceController,
    commandDeleteTypes({ controller: workspaceController }),
    commandUpdateTypes({ controller: workspaceController }),
    commandShowTypeFiles(),
    commandHideTypeFiles({ controller: workspaceController }),

    languages.registerDefinitionProvider(
      codeSelector,
      new CMTDDefinitionProvider({ workspaceController }),
    ),
    languages.registerHoverProvider(codeSelector, new CMTDHoverProvider({ workspaceController })),
    languages.registerCompletionItemProvider(
      codeSelector,
      new CMTDSelectorsCompletionProvider({ workspaceController }),
      '.',
      '[',
    ),
    languages.registerReferenceProvider(
      codeSelector,
      new CSSReferenceProvider({ workspaceController }),
    ),
  );

  commands.executeCommand('cmtd.updateTypes');
}

export function deactivate(): void {
  // empty
}
