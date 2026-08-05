import { type TextDocument, type Uri, workspace } from 'vscode';

import { isCssModule } from '../../common/index.ts';

import { type Usage } from '../css-information/class-usage.ts';
import { type State } from '../css-information/state.ts';
import { visit } from '../css-information/visit.ts';
import {
  collectImportBindings,
  getSourceFile,
  resolveImportPath,
  scanImports,
  UriMap,
} from '../helpers/index.ts';

export class CodeInformation {
  public static async create(uri: Uri): Promise<CodeInformation> {
    const document = await workspace.openTextDocument(uri);
    const cssModuleImports = scanImports(document).filter((u) => isCssModule(u));

    const sourceFile = getSourceFile(document);
    const bindings: UriMap<Set<string>> = new UriMap();
    const usages: UriMap<Usage[]> = new UriMap();

    for (const binding of collectImportBindings(sourceFile)) {
      const resolved = await resolveImportPath(document.uri.fsPath, binding.importModule);
      if (resolved) {
        bindings.getOrInsertComputed(resolved, () => new Set()).add(binding.variableName);
      }
    }

    for (const [importPath, bindingNames] of bindings) {
      const state: State = {
        bindingNames,
        seenUsages: new Set<string>(),
        usages: [],
        sourceFile,
      };

      visit(sourceFile, state);

      usages.getOrInsert(importPath, []).push(...state.usages);
    }

    return new CodeInformation(document, cssModuleImports, usages);
  }

  public readonly document: TextDocument;

  public readonly cssModuleImports: Uri[];
  public readonly usages: UriMap<Usage[]> = new UriMap();

  protected constructor(document: TextDocument, cssModuleImports: Uri[], usages: UriMap<Usage[]>) {
    this.document = document;
    this.usages = usages;
    this.cssModuleImports = cssModuleImports;
  }

  public async localUsage({
    localNames,
    importUri,
  }: {
    localNames: Set<string>;
    importUri: Uri;
  }): Promise<Usage[] | undefined> {
    return this.usages.get(importUri)?.filter((usage) => localNames.has(usage.localName));
  }
}
