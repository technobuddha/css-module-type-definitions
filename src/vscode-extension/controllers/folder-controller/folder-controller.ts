import { type Disposable, type WorkspaceFolder } from 'vscode';

import { type LoggerController } from '../../../common/index.ts';

import { FolderCode } from './folder-code.ts';

type FolderControllerOptions = {
  folder: WorkspaceFolder;
  logger: LoggerController;
};

export class FolderController extends FolderCode implements Disposable {
  public static async create({
    folder,
    logger,
  }: FolderControllerOptions): Promise<FolderController> {
    const controller = new FolderController({ folder, logger });

    await super.init(controller);
    return controller;
  }

  public constructor({ folder, logger }: FolderControllerOptions) {
    super({ folder, logger });
  }
}
