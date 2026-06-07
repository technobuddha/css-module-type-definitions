import { type CSSModulesOptions, type ResolvedCSSOptions } from 'vite';
import { RelativePattern, workspace, type WorkspaceFolder } from 'vscode';

import { defaultLogger, type Logger, readViteConfig, VITE_EXTENSIONS } from '../../common/index.ts';

import { VSDisposable } from './vs-disposable.ts';

export type ViteCss = Partial<
  Omit<ResolvedCSSOptions, 'modules' | 'lightningcss'> & {
    modules?: Omit<CSSModulesOptions, 'generateScopedName' | 'localsConvention'> & {
      generateScopedName?: Extract<CSSModulesOptions['generateScopedName'], string>;
      localsConvention?: Extract<CSSModulesOptions['localsConvention'], string>;
    };
  }
>;

type ViteWatcherOptions = {
  logger?: Logger;
};

export class ViteWatcher extends VSDisposable {
  public folder: WorkspaceFolder;
  public logger: Logger;
  public config: ViteCss | undefined;

  public static async create(
    folder: WorkspaceFolder,
    { logger = defaultLogger }: ViteWatcherOptions = {},
  ): Promise<ViteWatcher> {
    const watcher = new ViteWatcher(folder, { logger });

    await watcher.loadConfig();
    return watcher;
  }

  private constructor(folder: WorkspaceFolder, { logger }: Required<ViteWatcherOptions>) {
    super();
    this.folder = folder;
    this.logger = logger;

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
    this.config = await readViteConfig(this.folder.uri.fsPath, this.logger);
  }
}
