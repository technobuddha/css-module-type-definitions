import path from 'node:path';

import { isWithinDirectory, pathDepth, toError } from '@technobuddha/library';
import ignore, { type Ignore } from 'ignore';
import { type Disposable, RelativePattern, workspace, type WorkspaceFolder } from 'vscode';
import { type URI } from 'vscode-uri';

import { fileOperation, Ignorer, type LoggerController } from '../../common/index.ts';

type UriIgnorerOptions = {
  folder: WorkspaceFolder;
  logger: LoggerController;
  watch: boolean;
};

export class UriIgnorer extends Ignorer<URI> implements Disposable {
  protected readonly gitIgnores: Map<string, Ignore> = new Map();
  protected readonly ignored: Map<string, Ignore> = new Map();
  protected readonly folder: WorkspaceFolder;
  readonly #disposables: Disposable[] = [];

  public static async create({ folder, watch, logger }: UriIgnorerOptions): Promise<UriIgnorer> {
    const ignorer = new UriIgnorer({ folder, watch, logger });

    await Ignorer.init(ignorer);
    await ignorer.gatherGitIgnores();
    ignorer.buildIgnored();

    for (const dir of ignorer.ignored.keys()) {
      ignorer.logger.debug(
        fileOperation(path.join(folder.uri.fsPath, dir, '.gitignore'), 'configuration'),
      );
    }

    return ignorer;
  }

  private constructor({ folder, watch, logger }: UriIgnorerOptions) {
    super({ root: folder.uri.fsPath, watch, logger });
    this.folder = folder;

    if (watch) {
      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(folder, '**/.gitignore'),
      );

      this.#disposables.push(
        watcher,
        watcher.onDidChange(async (uri) => {
          this.logger.debug(fileOperation(uri.fsPath, 'change'));
          await this.readGitIgnore(uri);
          this.buildIgnored();
        }),
        watcher.onDidCreate(async (uri) => {
          this.logger.debug(fileOperation(uri.fsPath, 'add'));
          await this.readGitIgnore(uri);
          this.buildIgnored();
        }),
        watcher.onDidDelete(async (uri) => {
          this.logger.debug(fileOperation(uri.fsPath, 'unlink'));
          this.removeGitIgnore(uri);
          this.buildIgnored();
        }),
      );
    }
  }

  private async readGitIgnore(file: URI): Promise<void> {
    try {
      const dir = path.dirname(workspace.asRelativePath(file, false));
      const content = await workspace.fs.readFile(file).then(workspace.decode);
      this.gitIgnores.set(dir, ignore().add(content));
    } catch (error) {
      this.logger.error(toError(error), `Failed to read ignore file: ${file}`);
    }
  }

  private removeGitIgnore(file: URI): void {
    const dir = path.dirname(workspace.asRelativePath(file, false));
    this.gitIgnores.delete(dir);
  }

  private async gatherGitIgnores(): Promise<void> {
    return workspace
      .findFiles(new RelativePattern(this.folder, '**/.gitignore'))
      .then(async (files) => {
        for (const file of files) {
          await this.readGitIgnore(file);
        }
      });
  }

  protected buildIgnored(): void {
    this.ignored.clear();

    top: for (const [dir, ignored] of Array.from(this.gitIgnores.entries()).sort(
      ([a], [b]) => pathDepth(a) - pathDepth(b),
    )) {
      let parent = path.join(dir, '..');
      while (isWithinDirectory('.', parent)) {
        if (this.ignored.has(parent)) {
          const parentIgnored = this.ignored.get(parent)!;

          if (!parentIgnored.ignores(path.join(dir, '.gitignore'))) {
            this.ignored.set(dir, ignore().add(parentIgnored).add(ignored));
          }
          break top;
        }
        parent = path.join(parent, '..');
      }

      this.ignored.set(dir, this.ignorable().add(ignored));
    }
  }

  protected onChange(): void {
    this.buildIgnored();
  }

  public isIgnored(file: URI): boolean {
    const filepath = workspace.asRelativePath(file, false);
    let parent = path.dirname(filepath);

    while (isWithinDirectory('.', parent)) {
      if (this.ignored.has(parent)) {
        return this.ignored.get(parent)!.ignores(filepath);
      }
      parent = path.join(parent, '..');
    }

    return false;
  }

  public async findUnignoredFiles(pattern: string): Promise<URI[]> {
    const result: URI[] = [];

    for (const file of await workspace.findFiles(new RelativePattern(this.folder, pattern))) {
      if (!this.isIgnored(file)) {
        result.push(file);
      }
    }
    return result;
  }
}
