import { fileExists } from '@technobuddha/library';
import { type CSSModulesOptions, type ResolvedCSSOptions } from 'vite';
import { RelativePattern, Uri, workspace, type WorkspaceFolder } from 'vscode';

import { type Logger, readViteConfig, VITE_EXTENSIONS } from '../../common/index.ts';

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
  folder: WorkspaceFolder;
  logger: Logger;
};

export class ViteWatcher extends VSDisposable {
  public folder: WorkspaceFolder;
  public logger: Logger;
  public config: ViteCss | undefined;

  public static async create({ folder, logger }: ViteWatcherOptions): Promise<ViteWatcher> {
    const watcher = new ViteWatcher({ folder, logger });

    await watcher.loadConfig();
    return watcher;
  }

  private constructor({ folder, logger }: ViteWatcherOptions) {
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
