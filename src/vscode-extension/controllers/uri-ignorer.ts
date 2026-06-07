import { isWithinDirectory, pathDepth, toError } from '@technobuddha/library';
import ignore, { type Ignore } from 'ignore';
import { RelativePattern, workspace, type WorkspaceFolder } from 'vscode';
import { type URI, Utils } from 'vscode-uri';

import { defaultLogger, type Ignorer, type Logger } from '../../common/index.ts';

import { VSDisposable } from './vs-disposable.ts';

type UriIgnorerOptions = {
  logger?: Logger;
  watch?: boolean;
};

export class UriIgnorer extends VSDisposable implements Ignorer<URI> {
  public folder: WorkspaceFolder;
  public logger: Logger;
  public ignores: Map<URI, Ignore> = new Map();

  public static async create(
    folder: WorkspaceFolder,
    { logger = defaultLogger, watch = true }: UriIgnorerOptions = {},
  ): Promise<UriIgnorer> {
    const ignorer = new UriIgnorer(folder, { logger, watch });
    await ignorer.scanIgnoreFiles();

    return ignorer;
  }

  private constructor(folder: WorkspaceFolder, { logger, watch }: Required<UriIgnorerOptions>) {
    super();
    this.folder = folder;
    this.logger = logger;

    if (watch) {
      const pattern = new RelativePattern(folder, '**/.gitignore');

      const watcher = workspace.createFileSystemWatcher(pattern);

      this.disposables.push(
        watcher,
        watcher.onDidCreate(async () => this.scanIgnoreFiles()),
        watcher.onDidChange(async () => this.scanIgnoreFiles()),
        watcher.onDidDelete(async () => this.scanIgnoreFiles()),
      );
    }
  }

  private async scanIgnoreFiles(): Promise<void> {
    this.logger.debug(`<${this.folder.name}> scanning .gitignore files`);
    this.ignores.clear();

    return workspace
      .findFiles(new RelativePattern(this.folder, '**/.gitignore'))
      .then(async (files) => {
        for (const file of files) {
          if (!this.isIgnored(file)) {
            try {
              const dirname = Utils.dirname(file);
              const content = await workspace.fs.readFile(file).then(workspace.decode);
              this.ignores.set(dirname, ignore().add(content));
              this.logger.debug(
                `<${this.folder.name}> ignore: ${workspace.asRelativePath(file, false)}`,
              );
            } catch (error) {
              this.logger.error(toError(error));
            }
          }
        }
      });
  }

  public isIgnored(file: URI): boolean {
    try {
      const ignored = Array.from(
        this.ignores.entries().filter(([dir]) => isWithinDirectory(dir.path, file.path)),
      )
        .sort(([a], [b]) => pathDepth(a.path) - pathDepth(b.path))
        .reduce((main, [_, ig]) => main.add(ig), ignore());
      return ignored.ignores(workspace.asRelativePath(file));
    } catch (error) {
      this.logger.error(toError(error));
      return false;
    }
  }

  public async findUnignoredFiles(glob: string): Promise<URI[]> {
    const result: URI[] = [];
    const pattern = new RelativePattern(this.folder, glob);

    for (const file of await workspace.findFiles(pattern)) {
      if (!this.isIgnored(file)) {
        result.push(file);
      }
    }
    return result;
  }
}
