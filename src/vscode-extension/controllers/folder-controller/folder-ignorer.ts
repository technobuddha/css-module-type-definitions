import { empty, isWithinDirectory, pathDepth, toError } from '@technobuddha/library';
import ignore, { type Ignore } from 'ignore';
import { type Disposable, RelativePattern, type Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import { fileOperation, operation } from '../../../common/index.ts';

import { UriMap } from '../../helpers/index.ts';

import { FolderBase, type FolderBaseArguments } from './folder-base.ts';

export type FolderIgnorerArguments = FolderBaseArguments;

export abstract class FolderIgnorer extends FolderBase implements Disposable {
  protected readonly ignorers: UriMap<Ignore> = new UriMap();

  public constructor({ workspaceController, folder }: FolderIgnorerArguments) {
    super({ workspaceController, folder });
  }

  public override async init(): Promise<void> {
    await super.init();

    await this.buildIgnored();

    this.eventTarget.addEventListener('watcher', ({ detail: { action, uri } }) => {
      if (Utils.basename(uri) === '.gitignore') {
        this.logger.debug(fileOperation(uri.fsPath, action));
        void this.buildIgnored();
      }
    });
  }

  protected ignorer(file: Uri): Ignore | undefined {
    let parent = Utils.dirname(file);

    while (isWithinDirectory(this.folder.uri.fsPath, parent.fsPath)) {
      const ignorer = this.ignorers.get(parent);
      if (ignorer) {
        return ignorer;
      }

      parent = Utils.dirname(parent);
    }

    return undefined;
  }

  protected async buildIgnored(): Promise<void> {
    this.logger.trace(operation(`buildIgnored(${this.folder.name})`, 'start'));
    this.ignorers.clear();

    return workspace
      .findFiles(new RelativePattern(this.folder, '**/.gitignore'))
      .then(async (files) => {
        for (const file of Array.from(files).sort(
          (a, b) => pathDepth(a.fsPath) - pathDepth(b.fsPath),
        )) {
          const ignorer = this.ignorer(file);
          if (ignorer?.ignores(workspace.asRelativePath(file, false))) {
            continue;
          }

          const dir = Utils.dirname(file);
          try {
            const content = await workspace.fs.readFile(file).then(workspace.decode);
            this.ignorers.set(
              dir,
              ignore()
                .add(ignorer ?? empty)
                .add(content),
            );
            this.logger.debug(fileOperation(file.fsPath, 'configuration'));
          } catch (error) {
            this.logger.error(toError(error), `Failed to read ignore file: ${file}`);
          }
        }

        this.logger.trace(operation(`buildIgnored(${this.folder.name})`, 'finish'));
        this.eventTarget.dispatchEvent('ignored');
      });
  }

  public isIgnored(file: Uri): boolean {
    const ignorer = this.ignorer(file);
    if (ignorer) {
      return ignorer.ignores(workspace.asRelativePath(file, false));
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
