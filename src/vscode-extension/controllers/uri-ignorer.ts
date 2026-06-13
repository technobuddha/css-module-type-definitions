import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { isWithinDirectory, pathDepth, toError } from '@technobuddha/library';
import ignore, { type Ignore } from 'ignore';
import ini from 'ini';
import untildify from 'untildify';
import { RelativePattern, workspace, type WorkspaceFolder } from 'vscode';
import { type URI, Utils } from 'vscode-uri';

import { fileOperation, type Ignorer, type Logger } from '../../common/index.ts';

import { VSDisposable } from './vs-disposable.ts';

type UriIgnorerOptions = {
  folder: WorkspaceFolder;
  logger: Logger;
  watch: boolean;
};

export class UriIgnorer extends VSDisposable implements Ignorer<URI> {
  protected readonly folder: WorkspaceFolder;
  protected readonly logger: Logger;
  protected readonly gitConfigFilename: string;
  protected readonly gitExcludeFilename: URI;
  protected readonly ignores: Map<URI, Ignore> = new Map();
  protected globalIgnoreFilename: string | undefined;

  public static async create({ folder, logger, watch }: UriIgnorerOptions): Promise<UriIgnorer> {
    const ignorer = new UriIgnorer({ folder, logger, watch });

    await ignorer.scanIgnores();

    return ignorer;
  }

  private constructor({ folder, logger, watch }: Required<UriIgnorerOptions>) {
    super();
    this.folder = folder;
    this.logger = logger;

    this.gitConfigFilename = path.resolve(os.homedir(), '.gitconfig');
    logger.debug(fileOperation(this.gitConfigFilename, 'configuration'));

    this.gitExcludeFilename = Utils.resolvePath(folder.uri, '.git', 'info', 'exclude');
    logger.debug(fileOperation(this.gitExcludeFilename.fsPath, 'configuration'));

    if (watch) {
      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(folder, '**/.gitignore'),
      );

      const respone = (action: 'add' | 'change' | 'unlink') => async (file: URI) => {
        logger.info(fileOperation(file.fsPath, action));
        await this.loadIgnore(file);
      };

      this.disposables.push(
        watcher,
        watcher.onDidCreate(respone('add')),
        watcher.onDidChange(respone('change')),
        watcher.onDidDelete(respone('unlink')),
      );
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
        } catch (err) {
          this.logger.error(toError(err));
        }

        if (process.env.XDG_CONFIG_HOME) {
          return path.join(process.env.XDG_CONFIG_HOME, 'git', 'ignore');
        }

        return path.join(process.env.HOME ?? os.homedir(), '.config', 'git', 'ignore');
      });

    if (this.globalIgnoreFilename !== globalIgnoreFilename) {
      if (this.globalIgnoreFilename) {
        // TODO this.configWatcher?.unwatch(this.globalIgnoreFilename);
      }

      this.globalIgnoreFilename = globalIgnoreFilename;
      // TODO this.configWatcher?.add(globalIgnoreFilename);
      // TODO await this.loadGlobalIgnore();
    }
  }

  protected async loadIgnore(file: URI): Promise<void> {
    try {
      const dirname = Utils.dirname(file);
      const content = await workspace.fs.readFile(file).then(workspace.decode);
      this.ignores.set(dirname, ignore().add(content));
    } catch {}
  }

  private async scanIgnores(): Promise<void> {
    this.ignores.clear();

    return workspace
      .findFiles(new RelativePattern(this.folder, '**/.gitignore'))
      .then(async (files) => {
        for (const file of files) {
          // TODO possible check if this file is ignored by parent .gitignore files?
          await this.loadIgnore(file);
          this.logger.debug(fileOperation(file.fsPath, 'configuration'));
        }
      });
  }

  public isIgnored(file: URI): boolean {
    const name = workspace.asRelativePath(file);

    return [
      // this.globalIgnore,
      // this.repoIgnore,
      ...Array.from(this.ignores.entries().filter(([dir]) => isWithinDirectory(dir.fsPath, name)))
        .sort(([a], [b]) => pathDepth(a.fsPath) - pathDepth(b.fsPath))
        .map(([_, ig]) => ig),
    ]
      .filter((ig) => ig !== undefined)
      .reduce((main, ig) => main.add(ig), ignore())
      .ignores(name);
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
