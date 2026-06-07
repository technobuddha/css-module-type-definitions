import path from 'node:path';

import { RelativePattern, workspace } from 'vscode';

import { config } from '../extension.ts';
import { deleteTypes } from '../helpers/delete-types.ts';
import { generateTypes } from '../helpers/generate-types.ts';

import { VSDisposable } from './vs-disposable.ts';

export class FileWatcherController extends VSDisposable {
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
      async () => {
        config.logger.info('Configuration changed, reloading options and file watchers');
        await this.dispose();
        this.loadOptions();
        this.listenForChanges();
      },
      this,
      this.disposables,
    );
  }

  private loadOptions(): void {
    for (const folder of workspace.workspaceFolders ?? []) {
      const pattern = `**/${config.globIsCss(folder)}`;
      const watcher = workspace.createFileSystemWatcher(new RelativePattern(folder, pattern));
      this.disposables.push(
        watcher,
        watcher.onDidChange(async (uri) => {
          config.logger.info(`didChanged: ${uri.toString(true)}`);
          const options = config.options(folder);

          if (!config.isIgnored(uri)) {
            await generateTypes(uri, { options, logger: config.logger });
            config.logger.info(`Updated types for ${path.basename(uri.fsPath)}`);
          }
        }),
        watcher.onDidCreate(async (uri) => {
          config.logger.info(`didCreate: ${uri.toString(true)}`);
          const options = config.options(folder);

          if (!config.isIgnored(uri)) {
            await generateTypes(uri, { options, logger: config.logger });
            config.logger.info(`Created types for ${path.basename(uri.fsPath)}`);
          }
        }),
        watcher.onDidDelete(async (uri) => {
          config.logger.info(`didDelete: ${uri.toString(true)}`);
          if (!config.isIgnored(uri)) {
            await deleteTypes(uri);
            config.logger.info(`Deleted types for ${path.basename(uri.fsPath)}`);
          }
        }),
      );
    }
  }
}
