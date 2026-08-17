import { type Disposable } from 'vscode';

import { operation } from '../../../common/index.ts';

import { FolderCode, type FolderCodeArguments } from './folder-code.ts';

type FolderControllerArguments = FolderCodeArguments;

export class FolderController extends FolderCode implements Disposable {
  public constructor({ workspaceController, folder }: FolderControllerArguments) {
    super({ workspaceController, folder });
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
