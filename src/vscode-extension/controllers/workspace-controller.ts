import { type Disposable, type Uri, workspace, type WorkspaceFolder } from 'vscode';

import { type Logger, type LoggerController } from '../../common/index.ts';

import { createLogger } from '../create-logger.ts';

import { FolderController } from './folder-controller/index.ts';

export class WorkspaceController implements Disposable, LoggerController {
  public static async create(): Promise<WorkspaceController> {
    const controller = new WorkspaceController();

    await controller.updateFolders();

    return controller;
  }

  protected readonly disposables: Disposable[] = [];
  public readonly folders: Map<WorkspaceFolder, FolderController> = new Map();
  public readonly logger: Logger = createLogger();

  public constructor() {
    this.disposables.push(
      // workspace.onDidChangeConfiguration(async (event) => {
      //   if (event.affectsConfiguration(SETTINGS_PREFIX)) {
      //     this.logger.info('Relevant configuration change detected, updating options...');
      //     await this.loadOptions();
      //     this.onDidChangeEmitter.fire(event);
      //   }
      // }),
      workspace.onDidChangeWorkspaceFolders(async () => {
        await this.updateFolders();
      }),
    );
  }

  private async updateFolders(): Promise<void> {
    if (workspace.workspaceFolders) {
      for (const [folder, controller] of Array.from(this.folders)) {
        if (!workspace.workspaceFolders.includes(folder)) {
          await controller.dispose();
          this.folders.delete(folder);
        }
      }

      for (const folder of workspace.workspaceFolders) {
        if (!this.folders.has(folder)) {
          const controller = await FolderController.create({ folder, logger: this });
          // await controller.updateCssTypeDefinitions();
          this.folders.set(folder, controller);
        }
      }
    }
  }

  public folderController(file: Uri): FolderController | undefined {
    const folder = workspace.getWorkspaceFolder(file);
    if (folder) {
      return this.folders.get(folder);
    }

    return undefined;
  }

  public async dispose(): Promise<void> {
    for (const disposable of this.disposables) {
      await disposable.dispose();
    }
    this.disposables.length = 0;

    for (const [folder, controller] of Array.from(this.folders)) {
      await controller.dispose();
      this.folders.delete(folder);
    }
  }
}
