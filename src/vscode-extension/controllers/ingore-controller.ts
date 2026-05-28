import { isWithinDirectory, pathDepth, toError } from '@technobuddha/library';
import ignore, { type Ignore } from 'ignore';
import { RelativePattern, workspace, type WorkspaceFolder } from 'vscode';
import { type URI, Utils } from 'vscode-uri';

import { type Logger } from '../../common/logger.ts';

import { Controller } from './controller.ts';

type UriIgnorerOptions = {
  logger?: Logger;
  watch?: boolean;
};

export class UriIgnorer extends Controller {
  public folder: WorkspaceFolder;
  public logger: Logger;
  public ignores: Map<URI, Ignore> = new Map();

  public static async create(
    folder: WorkspaceFolder,
    { logger = console, watch = true }: UriIgnorerOptions = {},
  ): Promise<UriIgnorer> {
    const ignorer = new UriIgnorer(folder, { logger, watch });

    await workspace.findFiles('**/.gitignore').then(async (files) => {
      for (const file of files) {
        await ignorer.add(file);
      }
    });

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
        watcher.onDidCreate(async (f) => this.add(f)),
        watcher.onDidChange(async (f) => this.add(f)),
        watcher.onDidDelete(async (f) => this.del(f)),
      );
    }
  }

  private async add(file: URI): Promise<void> {
    this.logger.debug(`+ignore: ${file.toString(true)}`);
    const dirname = Utils.dirname(file);

    try {
      const content = await workspace.fs.readFile(file).then(workspace.decode);
      this.ignores.set(dirname, ignore().add(content));
    } catch (error) {
      this.logger.error(toError(error));
    }
  }

  private async del(file: URI): Promise<void> {
    this.logger.debug(`-ignore: ${file.toString(true)}`);
    const dirname = Utils.dirname(file);
    this.ignores.delete(dirname);
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
