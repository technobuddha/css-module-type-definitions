import os from 'node:os';

import { noop } from '@technobuddha/library';
import { type Location, Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import { type Logger, type Options } from '../../common/index.ts';
import {
  type CssGlobalInfo,
  cssImporter,
  type CssLocation,
  extractLocations,
} from '../../css-library/index.ts';

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
    return workspace
      .openTextDocument(uri)
      .then(
        async (document) =>
          extractLocations(document.getText(), {
            file: uri.fsPath,
            options,
            logger,
            cssImporter: cssImporter({ root: Utils.dirname(uri), logger }),
            relativeTo: os.homedir(),
          }).then(({ info }) => info),
        noop,
      )
      .then((cssInfo) => (cssInfo ? new CssGlobalInformation(cssInfo) : undefined));
  }

  public classNames: Set<string>;

  public locationsOfClass: ReadonlyMap<string, CssLocation[]>;
  public importedFiles: ReadonlyUriSet;

  private constructor({ locationsOfClass: classLocations, importedFiles }: CssGlobalInfo) {
    this.locationsOfClass = classLocations;
    this.importedFiles = new ReadonlyUriSet(importedFiles.values().map((file) => Uri.file(file)));

    this.classNames = new Set(classLocations.keys());
  }

  public cssLocations({
    className,
    importUri,
  }: {
    className: string;
    importUri: Uri;
  }): Location[] | null {
    const locations = this.locationsOfClass.get(className);
    if (locations) {
      return locations.map(({ location }) => toLocation(location, importUri));
    }

    return null;
  }
}
