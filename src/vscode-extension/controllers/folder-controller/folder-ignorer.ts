import path from 'node:path';

import { isWithinDirectory, pathDepth, toError } from '@technobuddha/library';
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
  public static override async init(controller: FolderBase): Promise<void> {
    await super.init(controller);

    if (controller instanceof this) {
      controller.setGitConfig(
        await GitConfig.watcher({ root: controller.folder.uri.fsPath, logger: controller }),
      );

      await controller.gatherGitIgnores();
      controller.buildIgnored();

      for (const dir of controller.ignored.keys()) {
        controller.logger.debug(
          fileOperation(
            path.join(controller.folder.uri.fsPath, dir, '.gitignore'),
            'configuration',
          ),
        );
      }
    }
  }

  protected gitConfig?: GitConfig;
  protected readonly gitIgnores: Map<string, Ignore> = new Map();
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

    this.eventTarget.addEventListener('watcher', async ({ detail: { action, uri } }) => {
      if (Utils.basename(uri) === '.gitignore') {
        this.logger.debug(fileOperation(uri.fsPath, action));
        if (action === 'unlink') {
          this.removeGitIgnore(uri);
        } else {
          await this.readGitIgnore(uri);
        }
        this.buildIgnored();
      }
    });
  }

  private setGitConfig(gitConfig: GitConfig): void {
    if (this.gitConfig) {
      void this.gitConfig.dispose();
    }

    this.gitConfig = gitConfig;
    this.gitConfig.onChange(() => {
      this.buildIgnored();
    });
  }

  private async readGitIgnore(file: Uri): Promise<void> {
    try {
      const dir = path.dirname(workspace.asRelativePath(file, false));
      const content = await workspace.fs.readFile(file).then(workspace.decode);
      this.gitIgnores.set(dir, ignore().add(content));
    } catch (error) {
      this.logger.error(toError(error), `Failed to read ignore file: ${file}`);
    }
  }

  private removeGitIgnore(file: Uri): void {
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

    this.eventTarget.dispatchEvent('ignored');
  }

  protected ignorable(): Ignore {
    const ig = ignore();

    if (this.gitConfig) {
      ig.add(this.gitConfig.gitIgnore);
    }
    return ig;
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
