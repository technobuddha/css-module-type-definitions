import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { empty, execPromise, toError } from '@technobuddha/library';
import chokidar, { type FSWatcher } from 'chokidar';

import { type Action } from './action.ts';
import { fileOperation } from './file-operation.ts';
import { type Logger, type LoggerController } from './logger.ts';

type Arguments = {
  root: string;
  logger: LoggerController;
};

type Changed = {
  gitIgnore: string;
};

export class GitConfig implements AsyncDisposable {
  private static async create({ root, logger }: Arguments): Promise<GitConfig> {
    logger.logger.error('creating GitConfig');

    const gc = new GitConfig({ root, logger });

    await Promise.all([
      gc
        .#getGlobalExcludesFilename()
        .then(async (filename) => {
          gc.#gitGlobalExcludesFilename = filename;
        })
        .then(async () =>
          gc.#readGlobalIgnore().then((content) => {
            gc.#globalIgnore = content;
          }),
        ),
      gc.#readRepoIgnore().then((content) => {
        gc.#repoIgnore = content;
      }),
    ]);

    return gc;
  }

  public static async watcher({ root, logger }: Arguments): Promise<GitConfig> {
    const gco = await this.create({ root, logger });

    gco.#watcher = chokidar.watch(gco.#gitRepoExcludeFilename, {
      ignoreInitial: true,
      atomic: true,
    });

    const respond =
      (action: Action) =>
      (file: string): void => {
        switch (file) {
          case gco.#gitRepoExcludeFilename: {
            gco.logger.debug(fileOperation(gco.#gitRepoExcludeFilename, action));

            void gco.#readRepoIgnore(action).then((content) => {
              if (gco.#repoIgnore !== content) {
                gco.#repoIgnore = content;
                gco.#changed();
              }
            });
            break;
          }

          case gco.#gitGlobalExcludesFilename: {
            gco.logger.debug(fileOperation(gco.#gitGlobalExcludesFilename!, action));

            void gco.#readGlobalIgnore(action).then((content) => {
              if (gco.#globalIgnore !== content) {
                gco.#globalIgnore = content;
                gco.#changed();
              }
            });
            break;
          }

          // no default
        }
      };

    gco.#watcher.on('add', respond('add'));
    gco.#watcher.on('change', respond('change'));
    gco.#watcher.on('unlink', respond('unlink'));

    gco.#interval = setInterval(() => {
      void gco.#getGlobalExcludesFilename().then((filename) => {
        if (filename !== gco.#gitGlobalExcludesFilename) {
          gco.#gitGlobalExcludesFilename = filename;

          void gco.#readGlobalIgnore().then((content) => {
            if (gco.#globalIgnore !== content) {
              gco.#globalIgnore = content;
              gco.#changed();
            }
          });
        }
      });
    }, 15000);

    return gco;
  }

  public static async ignored({ root, logger }: Arguments): Promise<string> {
    await using gco = await this.create({ root, logger });

    return gco.gitIgnore;
  }

  readonly #root: string;
  readonly #logger: LoggerController;
  readonly #gitRepoExcludeFilename: string;
  #gitGlobalExcludesFilename: string | undefined;
  #onChange: ((changed: Changed) => void) | undefined;
  #repoIgnore: string | undefined;
  #globalIgnore: string | undefined;
  #watcher: FSWatcher | undefined;
  #interval: ReturnType<typeof setInterval> | undefined;

  public constructor({ root, logger }: Arguments) {
    this.#root = path.resolve(root);
    this.#logger = logger;

    this.#gitRepoExcludeFilename = path.resolve(root, '.git', 'info', 'exclude');
  }

  async #getGlobalExcludesFilename(): Promise<string> {
    return execPromise('git config get core.excludesFile', {
      cwd: this.#root,
    })
      .then(({ stdout }) => stdout.trim())
      .catch(() =>
        process.env.XDG_CONFIG_HOME ?
          path.join(process.env.XDG_CONFIG_HOME, 'git', 'ignore')
        : path.join(process.env.HOME ?? os.homedir(), '.config', 'git', 'ignore'),
      );
  }

  async #readGlobalIgnore(action?: Action): Promise<string | undefined> {
    if (this.#gitGlobalExcludesFilename) {
      this.logger.debug(fileOperation(this.#gitGlobalExcludesFilename, action ?? 'configuration'));

      return fs.readFile(this.#gitGlobalExcludesFilename, 'utf-8').catch((e) => {
        if (e.code !== 'ENOENT') {
          this.logger.error(toError(e));
        }
        return undefined;
      });
    }
    return undefined;
  }

  async #readRepoIgnore(action?: Action): Promise<string | undefined> {
    if (this.#gitRepoExcludeFilename) {
      this.logger.debug(fileOperation(this.#gitRepoExcludeFilename, action ?? 'configuration'));
      return fs.readFile(this.#gitRepoExcludeFilename, 'utf-8').catch((e) => {
        if (e.code !== 'ENOENT') {
          this.logger.error(toError(e));
        }
        return undefined;
      });
    }

    return undefined;
  }

  #changed(): void {
    this.#onChange?.({ gitIgnore: this.gitIgnore });
  }

  private get logger(): Logger {
    return this.#logger.logger;
  }

  public get gitIgnore(): string {
    return `${this.#globalIgnore ?? empty}\n${this.#repoIgnore ?? empty}`;
  }

  public onChange(callback: (changed: Changed) => void): void {
    this.#onChange = callback;
  }

  public async dispose(): Promise<void> {
    return this[Symbol.asyncDispose]();
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    this.#onChange = undefined;

    if (this.#watcher) {
      await this.#watcher.close();
      this.#watcher = undefined;
    }

    if (this.#interval) {
      clearInterval(this.#interval);
      this.#interval = undefined;
    }
  }
}
