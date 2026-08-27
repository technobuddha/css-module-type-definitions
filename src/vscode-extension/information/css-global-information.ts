import os from 'node:os';

import { type Location, Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import { fileOperation, type Logger, type Options } from '../../common/index.ts';
import { type CssGlobalInfo, type CssLocation, extractLocations } from '../../css-library/index.ts';

import { cssImporter } from '../css-importer/index.ts';
import { ReadonlyUriSet } from '../helpers/index.ts';

import { type CssInformation } from './css-information.ts';
import { toLocation } from './to-location.ts';

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
      const { info } = await extractLocations(document.getText(), {
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

  public classNames: ReadonlySet<string>;
  public locationsOfClass: ReadonlyMap<string, readonly CssLocation[]>;
  public importedFiles: ReadonlyUriSet;
  public hasDts = false;

  private constructor({ locationsOfClass: classLocations, importedFiles }: CssGlobalInfo) {
    this.locationsOfClass = classLocations;
    this.importedFiles = new ReadonlyUriSet(importedFiles.values().map((file) => Uri.file(file)));

    this.classNames = new Set(classLocations.keys());
  }

  public localClassNames(localName: string): ReadonlySet<string> | undefined {
    return this.locationsOfClass.has(localName) ? new Set([localName]) : undefined;
  }

  public async writeTypeDefinition(_logger: Logger): Promise<void> {
    // a no-op for global CSS files
  }

  public cssLocations({
    className,
    importUri,
  }: {
    className: string;
    importUri: Uri;
  }): readonly Location[] | null {
    const locations = this.locationsOfClass.get(className);
    if (locations) {
      return locations.map(({ location }) => toLocation(location, importUri));
    }

    return null;
  }
}
