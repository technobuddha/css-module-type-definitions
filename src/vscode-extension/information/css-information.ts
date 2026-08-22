import os from 'node:os';

import { noop } from '@technobuddha/library';
import { type Location, type Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import { type Logger, type Options } from '../../common/index.ts';
import { cssImporter, type CssInfo, extractLocations } from '../../css-library/index.ts';

import { toLocation } from './to-location.ts';

type Arguments = {
  readonly uri: Uri;
  readonly logger: Logger;
  readonly options: Options;
};

export class CssInformation implements CssInfo {
  public static async create({
    uri,
    logger,
    options,
  }: Arguments): Promise<CssInformation | undefined> {
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
          }).then(({ info }) => new CssInformation(info)),
        noop,
      )
      .then((cssInfo) => (cssInfo ? new CssInformation(cssInfo) : undefined));
  }

  public classLocations: CssInfo['classLocations'];
  public includedFiles: CssInfo['includedFiles'];

  private constructor({ classLocations, includedFiles }: CssInfo) {
    this.classLocations = classLocations;
    this.includedFiles = includedFiles;
  }

  public cssLocations({
    className,
    importUri,
  }: {
    className: string;
    importUri: Uri;
  }): Location[] | null {
    const locations = this.classLocations.get(className);
    if (locations) {
      return locations.map(({ location }) => toLocation(location, importUri));
    }

    return null;
  }
}
