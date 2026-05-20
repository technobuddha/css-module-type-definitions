import path from 'node:path';

import { window, workspace } from 'vscode';

import { deleteTypes } from '../helpers/delete-types.ts';
import { generateTypes } from '../helpers/generate-types.ts';

import { config } from '../extension.ts';

import { Controller } from './controller.ts';

export class FileWatcherController extends Controller {
  public static async create(): Promise<FileWatcherController> {
    return new FileWatcherController();
  }

  private constructor() {
    super();
    this.loadOptions();
    this.listenForChanges();
  }

  private listenForChanges(): void {
    config.onDidChange(
      () => {
        config.logger.log('Configuration changed, reloading options and file watchers');
        this.dispose();
        this.loadOptions();
        this.listenForChanges();
      },
      this,
      this.disposables,
    );
  }

  private loadOptions(): void {
    const pattern = `**/${config.globIsCss}`;

    const watcher = workspace.createFileSystemWatcher(pattern);
    this.disposables.push(
      watcher,
      watcher.onDidChange(async (uri) => {
        config.logger.log(`File changed: ${uri.fsPath}`);
        await generateTypes(uri);
        window.showInformationMessage(`Updated types for ${path.basename(uri.fsPath)}`);
      }),
      watcher.onDidCreate(async (uri) => {
        config.logger.log(`File created: ${uri.fsPath}`);
        await generateTypes(uri);
        window.showInformationMessage(`Created types for ${path.basename(uri.fsPath)}`);
      }),
      watcher.onDidDelete(async (uri) => {
        config.logger.log(`File deleted: ${uri.fsPath}`);
        await deleteTypes(uri);
        window.showInformationMessage(`Deleted types for ${path.basename(uri.fsPath)}`);
      }),
    );
  }
}
