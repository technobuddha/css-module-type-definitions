import { fileExists } from '@technobuddha/library';
import { RelativePattern, Uri, workspace, type WorkspaceFolder } from 'vscode';

import {
  type Logger,
  type LoggerController,
  readViteConfig,
  VITE_EXTENSIONS,
  type ViteCss,
} from '../../common/index.ts';

import { VSDisposable } from './vs-disposable.ts';

type ViteWatcherOptions = {
  folder: WorkspaceFolder;
  logger: LoggerController;
};

export class ViteWatcher extends VSDisposable {
  public folder: WorkspaceFolder;
  public config: ViteCss | undefined;
  readonly #logger: LoggerController;
  protected get logger(): Logger {
    return this.#logger.logger;
  }

  public static async create({ folder, logger }: ViteWatcherOptions): Promise<ViteWatcher> {
    const watcher = new ViteWatcher({ folder, logger });

    await watcher.loadConfig();
    return watcher;
  }

  private constructor({ folder, logger }: ViteWatcherOptions) {
    super();
    this.folder = folder;
    this.#logger = logger;

    const watcher = workspace.createFileSystemWatcher(
      new RelativePattern(folder, `vite.config.{${VITE_EXTENSIONS.join(',')}}`),
    );

    this.disposables.push(
      watcher,
      watcher.onDidCreate(async () => this.loadConfig()),
      watcher.onDidChange(async () => this.loadConfig()),
      watcher.onDidDelete(async () => this.loadConfig()),
    );
  }

  private async loadConfig(): Promise<void> {
    this.config = undefined;

    for (const ext of VITE_EXTENSIONS) {
      const configPath = Uri.joinPath(this.folder.uri, `vite.config.${ext}`);
      if (await fileExists(configPath.fsPath)) {
        this.config = await readViteConfig(configPath.fsPath, this.logger);
        break;
      }
    }
  }
}
