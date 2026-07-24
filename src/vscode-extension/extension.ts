import { commands, type DocumentSelector, type ExtensionContext, languages, window } from 'vscode';

import {
  commandDeleteTypes,
  commandHideTypeFiles,
  commandShowTypeFiles,
  commandUpdateTypes,
} from './commands/index.ts';
import { WorkspaceController } from './controllers/index.ts';
import {
  CodeCompletionItemProvider,
  CodeDefinitionProvider,
  CodeHoverProvider,
  CodeReferenceProvider,
  CodeRenameProvider,
  CssReferenceProvider,
  CssRenameProvider,
} from './providers/index.ts';

const codeSelector: DocumentSelector = [
  { scheme: 'file', language: 'typescriptreact' },
  { scheme: 'file', language: 'javascriptreact' },
  { scheme: 'file', language: 'typescript' },
  { scheme: 'file', language: 'javascript' },
];

const cssSelector: DocumentSelector = [
  { language: 'css', pattern: '**/*.css' },
  { language: 'less', pattern: '**/*.less' },
  { language: 'sass', pattern: '**/*.sass' },
  { language: 'scss', pattern: '**/*.scss' },
  { language: 'stylus', pattern: '**/*.styl' },
  { language: 'stylus', pattern: '**/*.stylus' },
];

export async function activate(context: ExtensionContext): Promise<void> {
  const workspaceController = await WorkspaceController.create();

  context.subscriptions.push(
    workspaceController,
    commandDeleteTypes({ controller: workspaceController }),
    commandUpdateTypes({ controller: workspaceController }),
    commandShowTypeFiles(),
    commandHideTypeFiles({ controller: workspaceController }),

    languages.registerDefinitionProvider(
      codeSelector,
      new CodeDefinitionProvider({ workspaceController }),
    ),
    languages.registerHoverProvider(codeSelector, new CodeHoverProvider({ workspaceController })),
    languages.registerCompletionItemProvider(
      codeSelector,
      new CodeCompletionItemProvider({ workspaceController }),
      '.',
      '[',
    ),
    languages.registerReferenceProvider(
      codeSelector,
      new CodeReferenceProvider({ workspaceController }),
    ),
    languages.registerRenameProvider(codeSelector, new CodeRenameProvider({ workspaceController })),
    languages.registerReferenceProvider(
      cssSelector,
      new CssReferenceProvider({ workspaceController }),
    ),
    languages.registerRenameProvider(cssSelector, new CssRenameProvider({ workspaceController })),
  );

  commands.executeCommand('cmtd.updateTypes');

  window.showInformationMessage('css-module-type-definitions is ready');
}

export function deactivate(): void {
  // empty
}
