import os from 'node:os';

import { type Location, Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import { fileOperation, type Logger, type Options } from '../../common/index.ts';
import { type CssGlobalInfo, generateCssGlobalInfo } from '../../css-library/index.ts';

import { type LocalOrExport } from '../controllers/folder-controller/local-or-export.ts';
import { cssImporter } from '../css-importer/index.ts';
import { ReadonlyUriSet, toLocation } from '../helpers/index.ts';

import { type CssInformation, type Export, type Snippet } from './css-information.ts';
import { ValueInformation } from './value-information.ts';

type Arguments = {
  readonly uri: Uri;
  readonly logger: Logger;
  readonly options: Options;
};

export class CssGlobalInformation implements CssInformation {
  public static async create({
    uri,
    logger,
    options,
  }: Arguments): Promise<CssGlobalInformation | undefined> {
    try {
      const document = await workspace.openTextDocument(uri);
      const { info } = await generateCssGlobalInfo(document.getText(), {
        file: uri.fsPath,
        options,
        logger,
        cssImporter: cssImporter({ root: Utils.dirname(uri), logger }),
        relativeTo: os.homedir(),
      });

      return new CssGlobalInformation(info);
    } catch (error) {
      logger.error(fileOperation(uri, 'error', error));
    }

    return undefined;
  }

  public exportNames: ReadonlySet<string>;
  public locationsOfAnimation: ReadonlyMap<string, readonly Location[]>;
  public informationOfValues: ReadonlyMap<string, ValueInformation>;
  public exports: ReadonlyMap<string, Export>;
  public importedFiles: ReadonlyUriSet;
  public hasDts = false;

  protected constructor({
    locationsOfAnimation,
    informationOfValues,
    exports,
    importedFiles,
  }: CssGlobalInfo) {
    this.locationsOfAnimation = new Map(
      locationsOfAnimation.entries().map(([key, value]) => [key, value.map(toLocation)]),
    );
    this.informationOfValues = new Map(
      informationOfValues.entries().map(([key, value]) => [key, new ValueInformation(value)]),
    );
    this.exports = new Map(
      exports.entries().map(([key, value]) => [
        key,
        {
          type: value.type,
          location: value.location.map(toLocation),
          snippet: [...value.snippet],
        },
      ]),
    );
    this.importedFiles = new ReadonlyUriSet(importedFiles.values().map((file) => Uri.file(file)));

    this.exportNames = new Set(exports.keys());
  }

  public localExportNames(localName: string): ReadonlySet<string> | undefined {
    return this.exports.has(localName) ? new Set([localName]) : undefined;
  }

  public async writeTypeDefinition(_logger: Logger): Promise<void> {
    // a no-op for global CSS files
  }

  public cssSnippets({ exportName }: LocalOrExport): readonly Snippet[] | undefined {
    if (exportName) {
      const snippets = this.exports.get(exportName)?.snippet;
      if (snippets) {
        return snippets.map((snippet) => ({ snippet, exportName }));
      }
    }
    return undefined;
  }

  public cssLocations({ exportName }: LocalOrExport): readonly Location[] | undefined {
    if (exportName) {
      return this.exports.get(exportName)?.location;
    }
    return undefined;
  }
}
