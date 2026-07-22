import { type SourceFile } from 'typescript';
import { type TextDocument, type Uri } from 'vscode';

import { collectImportBindings } from './collect-import-bindings.ts';
import { resolveImportPath } from './resolve-import-path.ts';

export async function importBindingNames(
  document: TextDocument,
  sourceFile: SourceFile,
  importUri: Uri,
): Promise<Set<string>> {
  const bindingNames = new Set<string>();

  for (const binding of collectImportBindings(sourceFile)) {
    const resolved = await resolveImportPath(document.uri.fsPath, binding.importModule);
    if (resolved?.fsPath === importUri.fsPath) {
      bindingNames.add(binding.variableName);
    }
  }

  return bindingNames;
}
