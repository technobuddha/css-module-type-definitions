import { deepEquals } from '@technobuddha/library';
import { type TextDocument, type Uri, workspace } from 'vscode';

import { isCssModule } from '../../common/index.ts';

import {
  collectImportBindings,
  getSourceFile,
  resolveImportPath,
  scanImports,
  UriMap,
} from '../helpers/index.ts';

import { type Usage } from './class-usage.ts';
import { type State } from './state.ts';
import { visit } from './visit.ts';

export class CodeInformation {
  public static async create(file: Uri): Promise<CodeInformation> {
    const document = await workspace.openTextDocument(file);
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

    return new CodeInformation(file, document, cssModuleImports, usages);
  }

  public readonly file: Uri;
  public readonly document: TextDocument;
  public readonly cssModuleImports: Uri[];
  public readonly usages: UriMap<Usage[]> = new UriMap();

  protected constructor(
    file: Uri,
    document: TextDocument,
    cssModuleImports: Uri[],
    usages: UriMap<Usage[]>,
  ) {
    this.file = file;
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

  public equals(that: CodeInformation | undefined): boolean {
    if (that) {
      const s1 = new Set(this.cssModuleImports.map((uri) => uri.fsPath));
      const s2 = new Set(that.cssModuleImports.map((uri) => uri.fsPath));

      return (
        s1.size === s2.size &&
        s1.values().every((v) => s2.has(v)) &&
        this.usages.size === that.usages.size &&
        this.usages.entries().every(([uri, usages]) => deepEquals(usages, that.usages.get(uri)))
      );
    }
    return false;
  }
}
