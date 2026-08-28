import { noop } from '@technobuddha/library';
import { type Disposable, type Uri } from 'vscode';

import { globIsCssOrCode, type Options } from '../../../common/index.ts';

import { FolderOptions, type FolderOptionsArguments } from './folder-options.ts';

export type FolderFilesArguments = FolderOptionsArguments;

export abstract class FolderFiles extends FolderOptions implements Disposable {
  #refresh: Promise<void> | undefined = undefined;
  protected abstract handleOptions(args: {
    oldOptions: Options;
    newOptions: Options;
  }): Promise<void>;
  protected abstract handleIgnored(): Promise<void>;
  protected abstract handleOpenTab(uri: Uri): Promise<void>;
  protected abstract handleEditTab(uri: Uri): Promise<void>;
  protected abstract handleCloseTab(uri: Uri): Promise<void>;

  protected abstract updateInformation(uri: Uri): Promise<void>;
  protected abstract refreshInformation(uri: Uri): Promise<void>;
  protected abstract updateDiagnostics(uri: Uri): Promise<void>;

  protected async refreshAllInformation(): Promise<void> {
    if (!this.#refresh) {
      this.#refresh = this.findUnignoredFiles(`**/${globIsCssOrCode()}`).then(async (uris) =>
        Promise.all(uris.map(async (uri) => this.refreshInformation(uri))).then(noop),
      );
    }
    return this.#refresh;
  }
}
