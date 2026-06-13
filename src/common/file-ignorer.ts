import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { isWithinDirectory, noop, pathDepth } from '@technobuddha/library';
import chokidar, { type FSWatcher } from 'chokidar';
import { glob } from 'glob';
import ignore, { type Ignore } from 'ignore';
import ini from 'ini';
import untildify from 'untildify';

import { fileOperation } from './file-operation.ts';
import { type Ignorer } from './ignorer.ts';
import { type Logger } from './logger.ts';

type FileIgnorerOptions = {
  root: string;
  logger: Logger;
  watch: boolean;
};

export class FileIgnorer implements Ignorer<string>, AsyncDisposable {
  protected readonly root: string;
  protected readonly logger: Logger;
  protected readonly ignores: Map<string, Ignore> = new Map();
  protected readonly ignoreWatcher: FSWatcher | undefined;
  protected readonly configWatcher: FSWatcher | undefined;
  protected repoIgnore: Ignore | undefined;
  protected globalIgnore: Ignore | undefined;
  protected globalIgnoreFilename: string | undefined;
  protected readonly gitConfigFilename: string;
  protected readonly gitExcludeFilename: string;

  public static async create({ root, logger, watch }: FileIgnorerOptions): Promise<FileIgnorer> {
    const ignorer = new FileIgnorer({ root, logger, watch });

    await ignorer.getGlobalIgnoreFilename();
    await ignorer.loadGlobalIgnore();
    await ignorer.loadRepoIgnore();
    await ignorer.scanIgnores();

    return ignorer;
  }

  protected constructor({ root, logger, watch }: FileIgnorerOptions) {
    this.root = path.resolve(root);
    this.logger = logger;

    this.gitConfigFilename = path.resolve(os.homedir(), '.gitconfig');
    logger.debug(fileOperation(this.gitConfigFilename, 'configuration'));

    this.gitExcludeFilename = path.resolve(root, '.git', 'info', 'exclude');
    logger.debug(fileOperation(this.gitExcludeFilename, 'configuration'));

    if (watch) {
      const watcher = chokidar.watch([this.gitExcludeFilename, this.gitConfigFilename], {
        ignoreInitial: true,
        // persistent: true,
        atomic: true,
      });

      const respond =
        (action: 'add' | 'change' | 'unlink') =>
        (file: string): void => {
          (async () => {
            switch (file) {
              case this.gitConfigFilename: {
                this.logger.info(fileOperation(this.gitConfigFilename, action));
                await this.getGlobalIgnoreFilename();
                break;
              }

              case this.gitExcludeFilename: {
                this.logger.info(fileOperation(this.gitExcludeFilename, action));
                await this.loadRepoIgnore();
                break;
              }

              case this.globalIgnoreFilename: {
                this.logger.info(fileOperation(this.globalIgnoreFilename!, action));
                await this.loadGlobalIgnore();
                break;
              }

              // no default
            }
          })();
        };

      watcher.on('add', respond('add'));
      watcher.on('change', respond('change'));
      watcher.on('unlink', respond('unlink'));

      this.configWatcher = watcher;
    }

    if (watch) {
      const watcher = chokidar.watch(this.root, {
        ignored: (file, stats) =>
          (stats?.isFile() ?? false) && path.basename(file) !== '.gitignore',
        ignoreInitial: true,
        persistent: true,
      });

      const respond =
        (action: 'add' | 'change' | 'unlink') =>
        (file: string): void => {
          (async () => {
            this.logger.info(fileOperation(file, action));
            await this.loadIgnore(file);
          })();
        };

      watcher.on('add', respond('add'));
      watcher.on('change', respond('change'));
      watcher.on('unlink', respond('unlink'));

      this.ignoreWatcher = watcher;
    }
  }

  protected async getGlobalIgnoreFilename(): Promise<void> {
    const globalIgnoreFilename = await fs
      .readFile(path.join(os.homedir(), '.gitconfig'), 'utf-8')
      .then((content) => {
        try {
          const gitConfig = ini.parse(content);

          const excludesFile = gitConfig.core?.excludesFile;
          if (excludesFile) {
            return path.resolve(os.homedir(), untildify(excludesFile));
          }
        } catch {}

        if (process.env.XDG_CONFIG_HOME) {
          return path.join(process.env.XDG_CONFIG_HOME, 'git', 'ignore');
        }

        return path.join(process.env.HOME ?? os.homedir(), '.config', 'git', 'ignore');
      });

    if (this.globalIgnoreFilename !== globalIgnoreFilename) {
      if (this.globalIgnoreFilename) {
        this.configWatcher?.unwatch(this.globalIgnoreFilename);
      }

      this.globalIgnoreFilename = globalIgnoreFilename;
      this.configWatcher?.add(globalIgnoreFilename);
      await this.loadGlobalIgnore();
    }
  }

  protected async loadGlobalIgnore(): Promise<void> {
    this.globalIgnore = undefined;

    if (this.globalIgnoreFilename) {
      return fs
        .readFile(this.globalIgnoreFilename, 'utf-8')
        .then((content) => {
          this.globalIgnore = ignore().add(content);
        })
        .catch(noop);
    }
  }

  protected async loadRepoIgnore(): Promise<void> {
    return fs
      .readFile(this.gitExcludeFilename, 'utf-8')
      .then((content) => {
        this.repoIgnore = ignore().add(content);
      })
      .catch(noop);
  }

  protected async loadIgnore(file: string): Promise<void> {
    try {
      const dirname = path.dirname(path.relative(this.root, file));
      const content = await fs.readFile(file, 'utf-8');
      this.ignores.set(dirname, ignore().add(content));
    } catch {}
  }

  protected async scanIgnores(): Promise<void> {
    this.ignores.clear();

    for (const file of await glob('**/.gitignore', { cwd: this.root, dot: true })) {
      // TODO possible check if this file is ignored by parent .gitignore files?
      await this.loadIgnore(file);
      this.logger.debug(fileOperation(file, 'configuration'));
    }
  }

  public isIgnored(file: string): boolean {
    const name = path.relative(this.root, file);

    return [
      this.globalIgnore,
      this.repoIgnore,
      ...Array.from(this.ignores.entries().filter(([dir]) => isWithinDirectory(dir, name)))
        .sort(([a], [b]) => pathDepth(a) - pathDepth(b))
        .map(([_, ig]) => ig),
    ]
      .filter((ig) => ig !== undefined)
      .reduce((main, ig) => main.add(ig), ignore())
      .ignores(name);
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

  public async dispose(): Promise<void> {
    return this[Symbol.asyncDispose]();
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    await this.ignoreWatcher?.close();
    await this.configWatcher?.close();
  }
}
