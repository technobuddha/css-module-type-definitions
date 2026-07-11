import path from 'node:path';

import { empty, isWithinDirectory, pathDepth, toError } from '@technobuddha/library';
import ignore, { type Ignore } from 'ignore';
import {
  type Disposable,
  RelativePattern,
  type Uri,
  workspace,
  type WorkspaceFolder,
} from 'vscode';
import { Utils } from 'vscode-uri';

import { fileOperation, GitConfig, type LoggerController } from '../../../common/index.ts';

import { FolderBase } from './folder-base.ts';

type FolderControllerOptions = {
  folder: WorkspaceFolder;
  logger: LoggerController;
};

export class FolderIgnorer extends FolderBase implements Disposable {
  public static override async init(controller: FolderIgnorer): Promise<void> {
    await super.init(controller);

    controller.setGitConfig(
      await GitConfig.watcher({ root: controller.folder.uri.fsPath, logger: controller }),
    );

    workspace
      .findFiles(new RelativePattern(controller.folder, '**/.gitignore'))
      .then(async (files) => {
        for (const file of files) {
          const dir = path.dirname(workspace.asRelativePath(file, false));
          try {
            const content = await workspace.fs.readFile(file).then(workspace.decode);
            controller.gitIgnores.set(dir, content);
          } catch (error) {
            controller.logger.error(toError(error), `Failed to read ignore file: ${file}`);
          }
        }
      });

    controller.buildIgnored();

    for (const dir of controller.ignored.keys()) {
      controller.logger.debug(
        fileOperation(path.join(controller.folder.uri.fsPath, dir, '.gitignore'), 'configuration'),
      );
    }
  }

  #gitIgnore?: string;

  protected gitConfig?: GitConfig;
  protected readonly gitIgnores: Map<string, string> = new Map();
  protected readonly ignored: Map<string, Ignore> = new Map();

  public constructor({ folder, logger }: FolderControllerOptions) {
    super({ folder, logger });

    const watcher = workspace.createFileSystemWatcher(new RelativePattern(folder, '**/*'));

    const respond = (action: 'add' | 'change' | 'unlink') => async (uri: Uri) => {
      if (this.isIgnored(uri)) {
        return;
      }
      this.eventTarget.dispatchEvent('watcher', { action, uri });
    };

    this.disposables.push(
      watcher,
      watcher.onDidCreate(respond('add')),
      watcher.onDidChange(respond('change')),
      watcher.onDidDelete(respond('unlink')),
    );

    this.eventTarget.addEventListener('watcher', ({ detail: { action, uri } }) => {
      if (Utils.basename(uri) === '.gitignore') {
        this.logger.debug(fileOperation(uri.fsPath, action));
        if (action === 'unlink') {
          void this.removeGitIgnore(uri);
        } else {
          void this.readGitIgnore(uri);
        }
      }
    });
  }

  private setGitConfig(gitConfig: GitConfig): void {
    this.gitConfig = gitConfig;
    gitConfig.onChange(({ gitIgnore }) => {
      if (this.#gitIgnore !== gitIgnore) {
        this.#gitIgnore = gitIgnore;
        this.buildIgnored();
        this.changed();
      }
    });
  }

  private async readGitIgnore(file: Uri): Promise<void> {
    const dir = path.dirname(workspace.asRelativePath(file, false));
    try {
      const content = await workspace.fs.readFile(file).then(workspace.decode);

      if (content !== this.gitIgnores.get(dir)) {
        this.gitIgnores.set(dir, content);
        this.buildIgnored();
        this.changed();
      }
    } catch (error) {
      this.logger.error(toError(error), `Failed to read ignore file: ${file}`);
      if (this.gitIgnores.has(dir)) {
        this.gitIgnores.delete(dir);
        this.buildIgnored();
        this.changed();
      }
    }
  }

  private removeGitIgnore(file: Uri): void {
    const dir = path.dirname(workspace.asRelativePath(file, false));

    if (this.gitIgnores.has(dir)) {
      this.gitIgnores.delete(dir);
      this.buildIgnored();
      this.changed();
    }
  }

  private changed(): void {
    this.eventTarget.dispatchEvent('ignored');
  }

  protected ignorable(): Ignore {
    return ignore().add(this.#gitIgnore ?? empty);
  }

  protected buildIgnored(): void {
    this.ignored.clear();

    top: for (const [dir, ignored] of Array.from(this.gitIgnores).sort(
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

  public isIgnored(file: Uri): boolean {
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

  public async findUnignoredFiles(pattern: string): Promise<Uri[]> {
    const result: Uri[] = [];

    for (const file of await workspace.findFiles(new RelativePattern(this.folder, pattern))) {
      if (!this.isIgnored(file)) {
        result.push(file);
      }
    }
    return result;
  }
}
