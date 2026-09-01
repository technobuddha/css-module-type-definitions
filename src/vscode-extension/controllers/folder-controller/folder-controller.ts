import { type Disposable, type Uri } from 'vscode';

import { fileOperation, isCode, isCss, operation } from '../../../common/index.ts';

import { UriSet } from '../../helpers/uri-set.ts';

import { FolderCode, type FolderCodeArguments } from './folder-code.ts';

type FolderControllerArguments = FolderCodeArguments;

export class FolderController extends FolderCode implements Disposable {
  #prepare: Promise<void> | undefined;
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

  protected override async handleOpenTab(uri: Uri): Promise<void> {
    await this.prepare();
    await super.handleOpenTab(uri);
    this.workspaceController.refreshCodeLenses();
  }

  protected override async handleEditTab(uri: Uri): Promise<void> {
    if (isCode(uri) || isCss(uri)) {
      this.logger.debug(fileOperation(uri, 'edited'));
      await this.prepare();
      await super.updateAffected(uri);
      this.workspaceController.refreshCodeLenses();
    }
  }

  protected override async handleCloseTab(uri: Uri): Promise<void> {
    return super.handleCloseTab(uri);
  }

  protected override init(): Promise<void>[] {
    return super.init();
  }

  public async prepare(): Promise<void> {
    if (this.#prepare) {
      return this.#prepare;
    }

    this.workspaceController.spin(true);

    this.logger.info(operation(this.folder.name, 'start'));
    this.#prepare = Promise.all(this.init())
      .then(async () => this.refreshAllInformation())
      .then(() => this.logger.info(operation(this.folder.name, 'ready')))
      .finally(() => this.workspaceController.spin(false));
    return this.#prepare;
  }

  public override async close(): Promise<void> {
    await this.dispose();
    if (this.#prepare) {
      this.logger.info(operation(this.folder.name, 'stop'));
    }
  }
}
