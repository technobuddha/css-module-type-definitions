import { type DocumentSelector, type ExtensionContext, languages } from 'vscode';

import { CODE_EXTENSIONS, CSS_EXTENSIONS } from '../common/index.ts';

import {
  commandDeleteCssModuleTypeDefinitions,
  commandHideCssModuleTypeDefinitions,
  // commandHideGitIgnore,
  commandShowCssModuleTypeDefinitions,
  // commandShowGitIgnore,
  commandUpdateCssModuleTypeDefinitions,
} from './commands/index.ts';
import { WorkspaceController } from './controllers/index.ts';
import {
  CodeCompletionItemProvider,
  CodeDefinitionProvider,
  CodeHoverProvider,
  CodeReferenceProvider,
  CodeRenameProvider,
  CssCodeLensProvider,
  CssReferenceProvider,
  CssRenameProvider,
} from './providers/index.ts';

const codeSelector: DocumentSelector = { pattern: `**/*{${CODE_EXTENSIONS.join(',')}}` };
const cssSelector: DocumentSelector = { pattern: `**/*{${CSS_EXTENSIONS.join(',')}}` };

export async function activate(context: ExtensionContext): Promise<void> {
  const workspaceController = await WorkspaceController.create();

  const cssCodeLensProvider = new CssCodeLensProvider(workspaceController);
  await workspaceController.init();

  context.subscriptions.push(
    workspaceController,
    commandDeleteCssModuleTypeDefinitions({ controller: workspaceController }),
    commandUpdateCssModuleTypeDefinitions({ controller: workspaceController }),
    commandShowCssModuleTypeDefinitions(),
    commandHideCssModuleTypeDefinitions(),
    // commandShowGitIgnore(),
    // commandHideGitIgnore(),

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
    languages.registerCodeLensProvider(cssSelector, cssCodeLensProvider),
    cssCodeLensProvider,
  );
}

export function deactivate(): void {
  // empty
}
