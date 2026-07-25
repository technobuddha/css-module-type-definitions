import { CustomEventTarget } from '@technobuddha/library';
import { type Disposable, type Uri, type WorkspaceFolder } from 'vscode';

import { type Logger, type LoggerController, type Options } from '../../../common/index.ts';

type FolderControllerOptions = {
  folder: WorkspaceFolder;
  logger: LoggerController;
};

type WatcherEvent = {
  action: 'add' | 'change' | 'unlink';
  uri: Uri;
};

type OptionsEvent = {
  options: Options;
};

export class FolderBase implements LoggerController, Disposable {
  public static async init(_controller: FolderBase): Promise<void> {
    //
  }

  readonly #logger: LoggerController;
  protected readonly folder: WorkspaceFolder;

  protected readonly eventTarget = new CustomEventTarget<{
    watcher: WatcherEvent;
    options: OptionsEvent;
    ignored: undefined;
  }>();

  protected readonly disposables: Disposable[] = [];

  public constructor({ folder, logger }: FolderControllerOptions) {
    this.#logger = logger;
    this.folder = folder;
  }

  public get logger(): Logger {
    return this.#logger.logger;
  }

  public async dispose(): Promise<void> {
    for (const disposable of this.disposables) {
      await disposable.dispose();
    }
    this.disposables.length = 0;
  }
}
