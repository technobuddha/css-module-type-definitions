import fs from 'node:fs/promises';
import path from 'node:path';

import { isWithinDirectory, pathDepth, toError } from '@technobuddha/library';
import chokidar, { type FSWatcher } from 'chokidar';
import { glob } from 'glob';
import ignore, { type Ignore } from 'ignore';

import { type Action } from './action.ts';
import { fileOperation } from './file-operation.ts';
import { Ignorer } from './ignorer.ts';
import { type LoggerController } from './logger.ts';

type GitIgnore = {
  dir: string;
  ignored: Ignore;
};

type FileIgnorerOptions = {
  root: string;
  logger: LoggerController;
  watch: boolean;
};

export class FileIgnorer extends Ignorer<string> implements AsyncDisposable {
  public static async create({ root, logger, watch }: FileIgnorerOptions): Promise<FileIgnorer> {
    const ignorer = new FileIgnorer({ root, logger, watch });

    await super.init(ignorer);
    await ignorer.gatherGitIgnores();

    ignorer.buildIgnored();

    return ignorer;
  }

  #watcher: FSWatcher | undefined;
  protected readonly gitIgnores: GitIgnore[] = [];
  protected readonly ignored: Map<string, Ignore> = new Map();

  protected constructor({ root, logger, watch }: FileIgnorerOptions) {
    super({ root, logger, watch });

    if (watch) {
      const watcher = chokidar.watch('.', {
        cwd: root,
        ignored: (file, stats) =>
          (stats?.isFile() ?? false) && path.basename(file) !== '.gitignore',
        ignoreInitial: true,
        atomic: true,
      });

      const respond =
        (action: Action) =>
        (file: string): void => {
          void this.gatherGitIgnores()
            .then(() => this.buildIgnored())
            .then(() => {
              this.logger.debug(fileOperation(file, action));
            });
        };

      watcher.on('add', respond('add'));
      watcher.on('change', respond('change'));
      watcher.on('unlink', respond('unlink'));

      this.#watcher = watcher;
    }
  }

  protected async gatherGitIgnores(): Promise<void> {
    this.gitIgnores.length = 0;

    for (const file of await glob('**/.gitignore', { cwd: this.root, dot: true })) {
      await fs
        .readFile(file, 'utf-8')
        .then((content) => {
          this.gitIgnores.push({ dir: path.dirname(file), ignored: ignore().add(content) });
        })
        .catch((error) => {
          this.logger.error(toError(error), `Failed to read ignore file: ${file}`);
        });
    }
  }

  protected buildIgnored(): void {
    this.ignored.clear();

    top: for (const { dir, ignored } of this.gitIgnores.sort(
      ({ dir: a }, { dir: b }) => pathDepth(a) - pathDepth(b),
    )) {
      let parent = path.join(dir, '..');
      while (isWithinDirectory('.', parent)) {
        if (this.ignored.has(parent)) {
          this.ignored.set(dir, ignore().add(this.ignored.get(parent)!).add(ignored));
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

  public isIgnored(file: string): boolean {
    let parent = path.relative(this.root, file);
    while (isWithinDirectory('.', parent)) {
      if (this.ignored.has(parent)) {
        return this.ignored.get(parent)!.ignores(file);
      }
      parent = path.join(parent, '..');
    }

    return false;
  }

  public async findUnignoredFiles(pattern: string): Promise<string[]> {
    const result: string[] = [];

    for (const file of await glob(pattern, { cwd: this.root, dot: true })) {
      if (!this.isIgnored(file)) {
        result.push(file);
      }
    }
    return result;
  }

  public override async [Symbol.asyncDispose](): Promise<void> {
    await super[Symbol.asyncDispose]();
    await this.#watcher?.close();
    this.#watcher = undefined;
  }
}
