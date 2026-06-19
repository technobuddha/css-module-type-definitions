import { RelativePattern, workspace } from 'vscode';

import { fileOperation } from '../../common/file-operation.ts';
import { type Logger, type LoggerController } from '../../common/index.ts';

import { deleteTypes } from '../helpers/delete-types.ts';
import { generateTypes } from '../helpers/generate-types.ts';

import { config } from './configuration-controller.ts';
import { VSDisposable } from './vs-disposable.ts';

type FileWatcherControllerOptions = {
  logger: LoggerController;
};

export class FileWatcherController extends VSDisposable {
  readonly #logger: LoggerController;
  protected get logger(): Logger {
    return this.#logger.logger;
  }

  public static async create({
    logger,
  }: FileWatcherControllerOptions): Promise<FileWatcherController> {
    return new FileWatcherController({ logger });
  }

  private constructor({ logger }: FileWatcherControllerOptions) {
    super();
    this.#logger = logger;
    this.loadOptions();
    this.listenForChanges();
  }

  private listenForChanges(): void {
    config.onDidChange(
      async () => {
        this.logger.info('Configuration changed, reloading options and file watchers');
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
          this.logger.debug(fileOperation(uri.fsPath, 'change'));
          const options = config.options(folder);

          if (!config.isIgnored(uri)) {
            await generateTypes(uri, { options, logger: this.logger });
          }
        }),
        watcher.onDidCreate(async (uri) => {
          this.logger.debug(fileOperation(uri.fsPath, 'add'));
          const options = config.options(folder);

          if (!config.isIgnored(uri)) {
            await generateTypes(uri, { options, logger: this.logger });
          }
        }),
        watcher.onDidDelete(async (uri) => {
          this.logger.debug(fileOperation(uri.fsPath, 'unlink'));
          if (!config.isIgnored(uri)) {
            await deleteTypes(uri);
          }
        }),
      );
    }
  }
}
