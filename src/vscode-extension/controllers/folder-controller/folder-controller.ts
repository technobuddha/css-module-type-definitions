import { type Disposable, type Uri } from 'vscode';

import { operation } from '../../../common/index.ts';

import { UriSet } from '../../helpers/uri-set.ts';

import { FolderCode, type FolderCodeArguments } from './folder-code.ts';

type FolderControllerArguments = FolderCodeArguments;

export class FolderController extends FolderCode implements Disposable {
  readonly #updatingDiagnostics: UriSet = new UriSet();
  readonly #updatingInformation: UriSet = new UriSet();

  public constructor({ workspaceController, folder }: FolderControllerArguments) {
    super({ workspaceController, folder });
  }

  protected override async updateDiagnostics(uri: Uri): Promise<void> {
    if (!this.isIgnored(uri) && this.openTabs.has(uri)) {
      if (!this.#updatingDiagnostics.has(uri)) {
        this.#updatingDiagnostics.add(uri);

        await super.updateDiagnostics(uri);

        this.#updatingDiagnostics.delete(uri);
      }
    }
  }

  protected override async updateInformation(uri: Uri, override = false): Promise<void> {
    if (!this.isIgnored(uri)) {
      if (!this.#updatingInformation.has(uri)) {
        this.#updatingInformation.add(uri);

        await super.updateInformation(uri, override);

        this.#updatingInformation.delete(uri);
      }
    }
  }

  public override async init(): Promise<void> {
    await super.init();
    this.logger.debug(operation(this.folder.name, 'start'));
  }

  public override async close(): Promise<void> {
    await this.dispose();
    this.logger.debug(operation(this.folder.name, 'stop'));
  }
}
