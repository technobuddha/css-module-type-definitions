import { type Uri, workspace } from 'vscode';

import { getSourceFile, type ReadonlyUriMap, ReadonlyUriSet } from '../helpers/index.ts';

import { extractUsage } from './extract-usage.ts';
import { scanImports } from './scan-imports.ts';
import { type Usage } from './usage.ts';

export class CodeInformation {
  public static async create(file: Uri, root: Uri): Promise<CodeInformation> {
    const document = await workspace.openTextDocument(file);
    const sourceFile = getSourceFile(document);
    const { usages, importedCssUnbound } = await extractUsage(sourceFile, file);
    const importedFiles = new ReadonlyUriSet(usages.keys(), importedCssUnbound);

    const { modules, packages } = scanImports(sourceFile, root);

    return new CodeInformation(file, importedFiles, usages, importedCssUnbound, modules, packages);
  }

  public readonly file: Uri;
  public readonly usages: ReadonlyUriMap<readonly Usage[]>;
  public readonly importedCssBound: ReadonlyUriSet;
  public readonly importedCssUnbound: ReadonlyUriSet;
  public readonly importedPackages: ReadonlySet<string>;
  public readonly importedModules: ReadonlyUriSet;

  protected constructor(
    file: Uri,
    importedCssBound: ReadonlyUriSet,
    usages: ReadonlyUriMap<readonly Usage[]>,
    importedCssUnbound: ReadonlyUriSet,
    modules: ReadonlyUriSet,
    packages: ReadonlySet<string>,
  ) {
    this.file = file;
    this.usages = usages;
    this.importedCssBound = importedCssBound;
    this.importedCssUnbound = importedCssUnbound;
    this.importedPackages = packages;
    this.importedModules = modules;
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
