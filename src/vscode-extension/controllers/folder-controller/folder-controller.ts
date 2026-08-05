import { type Disposable } from 'vscode';

import { FolderCode, type FolderCodeArguments } from './folder-code.ts';

type FolderControllerArguments = FolderCodeArguments;

export class FolderController extends FolderCode implements Disposable {
  public static async create({
    workspaceController,
    folder,
  }: FolderControllerArguments): Promise<FolderController> {
    const controller = new FolderController({ workspaceController, folder });

    await super.init(controller);
    return controller;
  }

  public constructor({ workspaceController, folder }: FolderControllerArguments) {
    super({ workspaceController, folder });
  }
}
