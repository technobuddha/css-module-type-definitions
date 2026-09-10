import os from 'node:os';

import { type Diagnostic, type Location, Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import {
  fileOperation,
  type LocalOrExport,
  type Logger,
  type Options,
} from '../../common/index.ts';
import {
  type CssGlobalInfo,
  type Export as CssExport,
  generateCssGlobalInfo,
} from '../../css-library/index.ts';

import { cssImporter } from '../css-importer/index.ts';
import { ReadonlyUriSet, toDiagnostic, toLocation } from '../helpers/index.ts';

import { ValueInformation } from './value-information.ts';

export type Export = {
  readonly type: CssExport['type'];
  readonly location: readonly Location[];
  readonly snippet: string[];
};

export type Snippet = {
  readonly snippet: string;
  readonly exportName: string;
};

type Arguments = {
  readonly uri: Uri;
  readonly logger: Logger;
  readonly options: Options;
};

export class CssGlobalInformation {
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
      logger.error(fileOperation(uri, 'error', error), '<== css-global-information:40');
    }

    return undefined;
  }

  public readonly exportNames: ReadonlySet<string>;
  public readonly locationsOfAnimation: ReadonlyMap<string, readonly Location[]>;
  public readonly informationOfValues: ReadonlyMap<string, ValueInformation>;
  public readonly exports: ReadonlyMap<string, Export>;
  public readonly localNamesOfExport: ReadonlyMap<string, ReadonlySet<string>>;
  public readonly exportNamesOfLocalName: ReadonlyMap<string, ReadonlySet<string>>;

  public readonly diagnostics: readonly Diagnostic[];
  public readonly importedFiles: ReadonlyUriSet;
  public hasDts: boolean;

  protected constructor({
    locationsOfAnimation,
    informationOfValues,
    localNamesOfExport,
    exportNamesOfLocalName,
    exports,
    diagnostics,
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
    this.localNamesOfExport = new Map(
      localNamesOfExport.entries().map(([key, value]) => [key, new Set(value)]),
    );
    this.exportNamesOfLocalName = new Map(
      exportNamesOfLocalName.entries().map(([key, value]) => [key, new Set(value)]),
    );

    this.diagnostics = diagnostics.map(toDiagnostic);
    this.importedFiles = new ReadonlyUriSet(importedFiles.values().map((file) => Uri.file(file)));

    this.exportNames = new Set(exports.keys());
    this.hasDts = false;
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
