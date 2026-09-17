import { type Uri, workspace } from 'vscode';

import { type ReadonlyUriMap, ReadonlyUriSet } from '../helpers/index.ts';

import { extractUsage } from './extract-usage.ts';
import { type Usage } from './usage.ts';

export class CodeInformation {
  public static async create(file: Uri): Promise<CodeInformation> {
    const document = await workspace.openTextDocument(file);
    const { usages, unboundCssImports } = await extractUsage(document);
    const importedFiles = new ReadonlyUriSet(usages.keys(), unboundCssImports);

    return new CodeInformation(file, importedFiles, usages, unboundCssImports);
  }

  public readonly file: Uri;
  public readonly usages: ReadonlyUriMap<readonly Usage[]>;
  public readonly boundCssImports: ReadonlyUriSet;
  public readonly unboundCssImports: ReadonlyUriSet;

  protected constructor(
    file: Uri,
    boundCssImports: ReadonlyUriSet,
    usages: ReadonlyUriMap<readonly Usage[]>,
    unboundCssImports: ReadonlyUriSet,
  ) {
    this.file = file;
    this.usages = usages;
    this.boundCssImports = boundCssImports;
    this.unboundCssImports = unboundCssImports;
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
