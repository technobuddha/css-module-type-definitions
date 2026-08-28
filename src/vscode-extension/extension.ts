import { type ExtensionContext, languages } from 'vscode';

import {
  commandDeleteCssModuleTypeDefinitions,
  commandHideCssModuleTypeDefinitions,
  commandHideGitIgnore,
  commandShowCssModuleTypeDefinitions,
  commandShowGitIgnore,
  commandUpdateCssModuleTypeDefinitions,
} from './commands/index.ts';
import { WorkspaceController } from './controllers/index.ts';
import { codeSelector, cssSelector } from './document-selectors.ts';
import {
  CodeCompletionItemProvider,
  CodeDefinitionProvider,
  CodeHoverProvider,
  CodeReferenceProvider,
  CodeRenameProvider,
  CssReferenceProvider,
  CssRenameProvider,
} from './providers/index.ts';

export async function activate(context: ExtensionContext): Promise<void> {
  const workspaceController = await WorkspaceController.create();
  await workspaceController.init();

  context.subscriptions.push(
    workspaceController,
    commandDeleteCssModuleTypeDefinitions({ controller: workspaceController }),
    commandUpdateCssModuleTypeDefinitions({ controller: workspaceController }),
    commandShowCssModuleTypeDefinitions(),
    commandHideCssModuleTypeDefinitions(),
    commandShowGitIgnore(),
    commandHideGitIgnore(),

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
