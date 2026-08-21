import fs from 'node:fs/promises';
import path from 'node:path';

import { pathDepth, toError } from '@technobuddha/library';
import chokidar, { type FSWatcher } from 'chokidar';
import { glob } from 'glob';
import ignore, { type Ignore } from 'ignore';

import {
  type Action,
  fileOperation,
  type Logger,
  type LoggerController,
  operation,
} from '../common/index.ts';

type FileIgnorerOptions = {
  readonly root: string;
  readonly logger: LoggerController;
  readonly watch: boolean;
};

export class Ignorer implements AsyncDisposable {
  public static async create({ root, logger, watch }: FileIgnorerOptions): Promise<Ignorer> {
    const ignorer = new Ignorer({ root, logger, watch });

    await ignorer.scanIgnores();
    return ignorer;
  }

  #watcher: FSWatcher | undefined;
  readonly #root: string;
  readonly #logger: LoggerController;
  protected readonly ignorers: Map<string, Ignore> = new Map();

  protected constructor({ root, logger, watch }: FileIgnorerOptions) {
    this.#root = root;
    this.#logger = logger;

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
          void this.scanIgnores().then(() => {
            this.logger.debug(fileOperation(file, action));
          });
        };

      watcher.on('add', respond('add'));
      watcher.on('change', respond('change'));
      watcher.on('unlink', respond('unlink'));

      this.#watcher = watcher;
    }
  }

  private get logger(): Logger {
    return this.#logger.logger;
  }

  private async scanIgnores(): Promise<void> {
    this.ignorers.clear();

    return glob('**/.gitignore', { cwd: this.#root, dot: true }).then(async (files) => {
      for (const file of files.sort((a, b) => pathDepth(a) - pathDepth(b))) {
        const ignorer = this.ignorer(file);
        if (ignorer?.ignores(file)) {
          continue;
        }

        const dir = path.dirname(file);
        await fs
          .readFile(file, 'utf-8')
          .then((content) => {
            const ign = ignore();
            if (ignorer) {
              ign.add(ignorer);
            }
            ign.add(content);
            this.ignorers.set(dir, ign);
          })
          .catch((error) => {
            this.logger.error(fileOperation(file, 'error', toError(error)));
          });
      }
    });
  }

  private ignorer(file: string): Ignore | undefined {
    let parent = path.dirname(path.relative(this.#root, path.resolve(this.#root, file)));

    for (;;) {
      const ignorer = this.ignorers.get(parent);
      if (ignorer) {
        return ignorer;
      }

      if (parent === '.') {
        return undefined;
      }
      parent = path.dirname(parent);
    }
  }

  public isIgnored(file: string): boolean {
    const ignorer = this.ignorer(file);
    if (ignorer) {
      return ignorer.ignores(file);
    }

    return false;
  }

  public async findUnignoredFiles(pattern: string): Promise<string[]> {
    return glob(pattern, { cwd: this.#root, dot: true })
      .then((files) => files.filter((file) => !this.isIgnored(file)))
      .catch((error) => {
        this.logger.error(operation(`${this.#root}::findUnignoredFiles`, 'error', toError(error)));
        return [];
      });
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.#watcher?.close();
    this.#watcher = undefined;
  }
}
