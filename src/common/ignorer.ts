import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { toError } from '@technobuddha/library';
import chokidar, { type FSWatcher } from 'chokidar';
import ignore, { type Ignore } from 'ignore';
import ini from 'ini';
import untildify from 'untildify';

import { fileOperation } from './file-operation.ts';
import { type Logger } from './logger.ts';

type IgnorerOptions = {
  root: string;
  logger: Logger;
  watch: boolean;
};

export abstract class Ignorer<T> implements AsyncDisposable {
  readonly #gitLocalConfigFilename: string;
  readonly #gitGlobalConfigFilename: string;
  readonly #gitSystemConfigFilename: string;
  #gitGlobalExcludesFilename: string | undefined;
  readonly #gitLocalExcludeFilename: string;
  readonly #watcher: FSWatcher | undefined;

  protected readonly root: string;
  protected readonly logger: Logger;

  protected globalIgnore: Ignore | undefined;
  protected repoIgnore: Ignore | undefined;

  protected static async init<T>(ignorer: Ignorer<T>): Promise<void> {
    await ignorer.getGlobalExcludesFilename();
    await ignorer.loadRepoIgnore();
  }

  protected constructor({ root, logger, watch }: IgnorerOptions) {
    this.root = path.resolve(root);

    this.#gitLocalConfigFilename = path.resolve(root, '.git', 'config');
    this.#gitGlobalConfigFilename = path.resolve(os.homedir(), '.gitconfig');
    this.#gitSystemConfigFilename = path.resolve('/etc', 'gitconfig');

    this.#gitLocalExcludeFilename = path.resolve(root, '.git', 'info', 'exclude');

    this.logger = logger;

    if (watch) {
      const watcher = chokidar.watch(
        [
          this.#gitLocalExcludeFilename,
          this.#gitLocalConfigFilename,
          this.#gitGlobalConfigFilename,
          this.#gitSystemConfigFilename,
        ],
        {
          ignoreInitial: true,
          atomic: true,
        },
      );

      const respond =
        (action: 'add' | 'change' | 'unlink') =>
        (file: string): void => {
          (async () => {
            switch (file) {
              case this.#gitLocalConfigFilename:
              case this.#gitGlobalConfigFilename:
              case this.#gitSystemConfigFilename: {
                this.logger.debug(fileOperation(file, action));
                await this.getGlobalExcludesFilename();
                break;
              }

              case this.#gitLocalExcludeFilename: {
                await this.loadRepoIgnore(action);
                break;
              }

              case this.#gitGlobalExcludesFilename: {
                await this.loadGlobalIgnore(action);
                break;
              }

              // no default
            }
          })();
        };

      watcher.on('add', respond('add'));
      watcher.on('change', respond('change'));
      watcher.on('unlink', respond('unlink'));

      this.#watcher = watcher;
    }
  }

  protected abstract toFilename(file: T): string;

  protected ignorable(): Ignore {
    const ig = ignore();
    if (this.globalIgnore) {
      ig.add(this.globalIgnore);
    }
    if (this.repoIgnore) {
      ig.add(this.repoIgnore);
    }
    return ig;
  }

  public abstract isIgnored(file: T): boolean;

  public abstract findUnignoredFiles(glob: string): Promise<T[]>;

  private async getGlobalExcludesFilename(): Promise<void> {
    const globalExcludesFilename = await fs
      .readFile(this.#gitLocalConfigFilename, 'utf-8')
      .then(parseConfig)
      .catch(async () =>
        fs
          .readFile(this.#gitGlobalConfigFilename, 'utf-8')
          .then(parseConfig)
          .catch(async () =>
            fs
              .readFile(this.#gitSystemConfigFilename, 'utf-8')
              .then(parseConfig)
              .catch(() =>
                process.env.XDG_CONFIG_HOME ?
                  path.join(process.env.XDG_CONFIG_HOME, 'git', 'ignore')
                : path.join(process.env.HOME ?? os.homedir(), '.config', 'git', 'ignore'),
              ),
          ),
      );

    if (this.#gitGlobalExcludesFilename !== globalExcludesFilename) {
      if (this.#gitGlobalExcludesFilename) {
        this.#watcher?.unwatch(this.#gitGlobalExcludesFilename);
      }

      this.#gitGlobalExcludesFilename = globalExcludesFilename;

      this.#watcher?.add(globalExcludesFilename);

      await this.loadGlobalIgnore();
    }
  }

  private async loadGlobalIgnore(action?: 'add' | 'change' | 'unlink'): Promise<void> {
    this.globalIgnore = undefined;

    if (this.#gitGlobalExcludesFilename) {
      this.logger.info(fileOperation(this.#gitGlobalExcludesFilename, action ?? 'configuration'));

      return fs
        .readFile(this.#gitGlobalExcludesFilename, 'utf-8')
        .then((content) => {
          this.globalIgnore = ignore().add(content);
        })
        .catch((e) => {
          if (e.code === 'ENOENT') {
            this.globalIgnore = ignore();
          } else {
            this.logger.error(toError(e));
          }
        });
    }
  }

  private async loadRepoIgnore(action?: 'add' | 'change' | 'unlink'): Promise<void> {
    return fs
      .readFile(this.#gitLocalExcludeFilename, 'utf-8')
      .then((content) => {
        this.logger.info(fileOperation(this.#gitLocalExcludeFilename, action ?? 'configuration'));
        this.repoIgnore = ignore().add(content);
      })
      .catch((e) => {
        const error = toError(e);
        if (e.code === 'ENOENT') {
          if (action === 'unlink') {
            this.logger.info(fileOperation(this.#gitLocalExcludeFilename, action));
          }
          this.repoIgnore = ignore();
        } else {
          this.logger.error(error);
        }
      });
  }

  public async dispose(): Promise<void> {
    return this[Symbol.asyncDispose]();
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.#watcher?.close();
  }
}

function parseConfig(content: string): string {
  const { excludesFile } = ini.parse(content).core;
  if (excludesFile) {
    return untildify(excludesFile);
  }
  throw new Error('Cannot find excludesFile, falling into default');
}
