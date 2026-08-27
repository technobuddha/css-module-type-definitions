import { type Uri, workspace } from 'vscode';

import { isCss, type Logger } from '../../common/index.ts';

import { type ReadonlyUriMap, ReadonlyUriSet, scanImports } from '../helpers/index.ts';

import { extractUsage, type Usage } from './extract-usage.ts';

export class CodeInformation {
  public static async create(file: Uri, logger: Logger): Promise<CodeInformation> {
    const document = await workspace.openTextDocument(file);

    const importedFiles = new ReadonlyUriSet(
      scanImports(document, logger).filter((uri) => isCss(uri)),
    );

    const usages = await extractUsage(document);
    return new CodeInformation(file, importedFiles, usages);
  }

  public readonly file: Uri;
  public readonly importedFiles: ReadonlyUriSet;
  public readonly usages: ReadonlyUriMap<Usage[]>;

  protected constructor(file: Uri, importedFiles: ReadonlyUriSet, usages: ReadonlyUriMap<Usage[]>) {
    this.file = file;
    this.usages = usages;
    this.importedFiles = importedFiles;
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
