import { type Uri, workspace, type WorkspaceFolder } from 'vscode';

import {
  type Logger,
  type LoggerController,
  type NormalizedOptions,
  type OptionsController,
} from '../../common/index.ts';

import { createLogger } from '../create-logger.ts';

import { FolderController } from './folder-controller.ts';
import { VSDisposable } from './vs-disposable.ts';

export class WorkspaceController
  extends VSDisposable
  implements LoggerController, OptionsController
{

  public static async create(): Promise<WorkspaceController> {
    const controller = new WorkspaceController();

    await controller.updateFolders();

    return controller;
  }

  readonly #folders: Map<WorkspaceFolder, FolderController> = new Map();
  public readonly logger: Logger = createLogger();


  public constructor() {
    super();

    this.disposables.push(
      // workspace.onDidChangeConfiguration(async (event) => {
      //   if (event.affectsConfiguration(SETTINGS_PREFIX)) {
      //     this.logger.info('Relevant configuration change detected, updating options...');
      //     await this.loadOptions();
      //     this.onDidChangeEmitter.fire(event);
      //   }
      // }),
      workspace.onDidChangeWorkspaceFolders(async () => {
        this.logger.info('Workspace folders change detected');
        await this.updateFolders();
      }),
    );
  }

  private async updateFolders(): Promise<void> {
    if (workspace.workspaceFolders) {
      for (const [folder, controller] of Array.from(this.#folders)) {
        if (!workspace.workspaceFolders.includes(folder)) {
          await controller.dispose();
          this.#folders.delete(folder);
        }
      }

      for (const folder of workspace.workspaceFolders) {
        if (!this.#folders.has(folder)) {
          const controller = await FolderController.create({ folder, logger: this });
          this.#folders.set(folder, controller);
        }
      }
    }
  }

  public async findUnignoredFiles(folder: WorkspaceFolder, pattern: string): Promise<Uri[]> {
    return this.#folders.get(folder)?.findUnignoredFiles(pattern) ?? Promise.resolve([]);
  }

  public globIsTypeDefinition(folder: WorkspaceFolder): string {
    const folderController = this.#folders.get(folder);
    if (folderController) {
      return folderController.globIsTypeDefinition();
    }

    throw new Error(`No controller found for folder: ${folder.name}`);
  }

  public globIsCss(folder: WorkspaceFolder): string {
    const folderController = this.#folders.get(folder);
    if (folderController) {
      return folderController.globIsCss();
    }

    throw new Error(`No controller found for folder: ${folder.name}`);
  }

  public options(folder: WorkspaceFolder): NormalizedOptions {
    const folderController = this.#folders.get(folder);
    if (folderController) {
      return folderController.options;
    }

    throw new Error(`No controller found for folder: ${folder.name}`);
  }

  public override async dispose(): Promise<void> {
    await super.dispose();

    for (const [folder, controller] of Array.from(this.#folders)) {
      await controller.dispose();
      this.#folders.delete(folder);
    }
  }
}
