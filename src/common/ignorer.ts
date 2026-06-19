import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { execPromise, toError } from '@technobuddha/library';
import chokidar, { type FSWatcher } from 'chokidar';
import ignore, { type Ignore } from 'ignore';

import { fileOperation } from './file-operation.ts';
import { type Logger, type LoggerController } from './logger.ts';

type IgnorerOptions = {
  root: string;
  logger: LoggerController;
  watch: boolean;
};

export abstract class Ignorer<T> implements AsyncDisposable {
  readonly #gitLocalExcludeFilename: string;
  #gitGlobalExcludesFilename: string | undefined;
  #localIgnore: Ignore | undefined;
  #globalIgnore: Ignore | undefined;
  #watcher: FSWatcher | undefined;
  #interval: ReturnType<typeof setInterval> | undefined;

  protected readonly root: string;
  readonly #logger: LoggerController;
  protected get logger(): Logger {
    return this.#logger.logger;
  }

  protected static async init<T>(ignorer: Ignorer<T>): Promise<void> {
    await ignorer.#getGlobalExcludesFilename();
    await ignorer.#loadRepoIgnore();
  }

  protected constructor({ root, logger, watch }: IgnorerOptions) {
    this.root = path.resolve(root);
    this.#logger = logger;

    this.#gitLocalExcludeFilename = path.resolve(root, '.git', 'info', 'exclude');

    if (watch) {
      const watcher = chokidar.watch(this.#gitLocalExcludeFilename, {
        ignoreInitial: true,
        atomic: true,
      });

      const respond =
        (action: 'add' | 'change' | 'unlink') =>
        (file: string): void => {
          (async () => {
            switch (file) {
              case this.#gitLocalExcludeFilename: {
                await this.#loadRepoIgnore(action);
                break;
              }

              case this.#gitGlobalExcludesFilename: {
                await this.#loadGlobalIgnore(action);
                break;
              }

              // no default
            }
            this.onChange();
          })();
        };

      watcher.on('add', respond('add'));
      watcher.on('change', respond('change'));
      watcher.on('unlink', respond('unlink'));

      this.#watcher = watcher;

      this.#interval = setInterval(() => {
        void this.#getGlobalExcludesFilename();
      }, 10000);
    }
  }

  protected abstract onChange(): void;

  public abstract isIgnored(file: T): boolean;
  public abstract findUnignoredFiles(glob: string): Promise<T[]>;

  protected ignorable(): Ignore {
    const ig = ignore();
    if (this.#globalIgnore) {
      ig.add(this.#globalIgnore);
    }
    if (this.#localIgnore) {
      ig.add(this.#localIgnore);
    }
    return ig;
  }

  async #getGlobalExcludesFilename(): Promise<void> {
    const globalExcludesFilename = await execPromise('git config get core.excludesFile', {
      cwd: this.root,
    })
      .then(({ stdout }) => stdout.trim())
      .catch(() =>
        process.env.XDG_CONFIG_HOME ?
          path.join(process.env.XDG_CONFIG_HOME, 'git', 'ignore')
        : path.join(process.env.HOME ?? os.homedir(), '.config', 'git', 'ignore'),
      );

    if (this.#gitGlobalExcludesFilename !== globalExcludesFilename) {
      if (this.#gitGlobalExcludesFilename) {
        this.#watcher?.unwatch(this.#gitGlobalExcludesFilename);
      }

      this.#gitGlobalExcludesFilename = globalExcludesFilename;

      this.#watcher?.add(globalExcludesFilename);

      await this.#loadGlobalIgnore();
    }
  }

  async #loadGlobalIgnore(action?: 'add' | 'change' | 'unlink'): Promise<void> {
    this.#globalIgnore = undefined;

    if (this.#gitGlobalExcludesFilename) {
      this.logger.debug(fileOperation(this.#gitGlobalExcludesFilename, action ?? 'configuration'));

      return fs
        .readFile(this.#gitGlobalExcludesFilename, 'utf-8')
        .then((content) => {
          this.#globalIgnore = ignore().add(content);
        })
        .catch((e) => {
          if (e.code !== 'ENOENT') {
            this.logger.error(toError(e));
          }
        });
    }
  }

  async #loadRepoIgnore(action?: 'add' | 'change' | 'unlink'): Promise<void> {
    this.#localIgnore = undefined;

    if (this.#gitLocalExcludeFilename) {
      this.logger.debug(fileOperation(this.#gitLocalExcludeFilename, action ?? 'configuration'));
      return fs
        .readFile(this.#gitLocalExcludeFilename, 'utf-8')
        .then((content) => {
          this.#localIgnore = ignore().add(content);
        })
        .catch((e) => {
          if (e.code !== 'ENOENT') {
            this.logger.error(toError(e));
          }
        });
    }
  }

  public async dispose(): Promise<void> {
    return this[Symbol.asyncDispose]();
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.#watcher?.close();
    this.#watcher = undefined;

    if (this.#interval) {
      clearInterval(this.#interval);
      this.#interval = undefined;
    }
  }
}
