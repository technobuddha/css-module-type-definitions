import { type DocumentSelector, type ExtensionContext, languages } from 'vscode';

import {
  commandDeleteCssModuleTypeDefinitions,
  commandHideCssModuleTypeDefinitions,
  commandShowCssModuleTypeDefinitions,
  commandUpdateCssModuleTypeDefinitions,
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
];

export async function activate(context: ExtensionContext): Promise<void> {
  const workspaceController = await WorkspaceController.create();
  await workspaceController.init();

  context.subscriptions.push(
    workspaceController,
    commandDeleteCssModuleTypeDefinitions({ controller: workspaceController }),
    commandUpdateCssModuleTypeDefinitions({ controller: workspaceController }),
    commandShowCssModuleTypeDefinitions(),
    commandHideCssModuleTypeDefinitions(),

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
}

export function deactivate(): void {
  // empty
}
