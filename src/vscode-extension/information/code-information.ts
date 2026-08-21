import { type Uri, workspace } from 'vscode';

import { isCss, type Logger } from '../../common/index.ts';

import {
  collectImportBindings,
  getSourceFile,
  type ReadonlyUriMap,
  ReadonlyUriSet,
  resolveImportPath,
  scanImports,
  UriMap,
} from '../helpers/index.ts';

import { type Usage } from './class-usage.ts';
import { type State } from './state.ts';
import { visit } from './visit.ts';

export class CodeInformation {
  public static async create(file: Uri, logger: Logger): Promise<CodeInformation> {
    const document = await workspace.openTextDocument(file);

    const cssImports = new ReadonlyUriSet(
      scanImports(document, logger).filter((uri) => isCss(uri)),
    );

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

    return new CodeInformation(file, cssImports, usages);
  }

  public readonly file: Uri;
  public readonly cssImports: ReadonlyUriSet;
  public readonly usages: ReadonlyUriMap<Usage[]>;

  protected constructor(file: Uri, cssImports: ReadonlyUriSet, usages: ReadonlyUriMap<Usage[]>) {
    this.file = file;
    this.usages = usages;
    this.cssImports = cssImports;
  }

  public async localUsage({
    localNames,
    importUri,
  }: {
    readonly localNames: ReadonlySet<string>;
    readonly importUri: Uri;
  }): Promise<Usage[] | undefined> {
    return this.usages.get(importUri)?.filter((usage) => localNames.has(usage.localName));
  }
}
