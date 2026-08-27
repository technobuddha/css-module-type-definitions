import { isWithinDirectory, pathDepth, toError } from '@technobuddha/library';
import ignore, { type Ignore } from 'ignore';
import { type Disposable, RelativePattern, type Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import { type Action, fileOperation, operation } from '../../../common/index.ts';

import { UriMap } from '../../helpers/index.ts';

import { FolderBase, type FolderBaseArguments } from './folder-base.ts';

export type FolderIgnorerArguments = FolderBaseArguments;

export abstract class FolderIgnorer extends FolderBase implements Disposable {
  private readonly scanned: Promise<void>;
  private readonly ignorers: UriMap<Ignore> = new UriMap();

  public constructor({ workspaceController, folder }: FolderIgnorerArguments) {
    super({ workspaceController, folder });

    this.scanned = this.scanIgnores();
  }

  private async scanIgnores(): Promise<void> {
    this.ignorers.clear();

    return workspace.findFiles(new RelativePattern(this.folder, '**/.gitignore')).then(
      async (files) => {
        for (const file of files.sort((a, b) => pathDepth(a.fsPath) - pathDepth(b.fsPath))) {
          const ignorer = this.ignorer(file);
          if (ignorer?.ignores(workspace.asRelativePath(file, false))) {
            continue;
          }

          const dir = Utils.dirname(file);
          await workspace.openTextDocument(file).then(
            (doc) => {
              const ign = ignore();
              if (ignorer) {
                ign.add(ignorer);
              }
              ign.add(doc.getText());
              this.ignorers.set(dir, ign);
            },
            (error) => {
              this.logger.error(fileOperation(file, 'error', toError(error)));
            },
          );
        }

        await this.fire('ignored');
      },
      (error) => {
        this.logger.error(fileOperation(this.folder.uri, 'error', toError(error)));
      },
    );
  }

  private ignorer(file: Uri): Ignore | undefined {
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

  protected async init(): Promise<void> {
    await this.scanned;
  }

  protected async handleWatcher({ action, uri }: { action: Action; uri: Uri }): Promise<void> {
    if (Utils.basename(uri) === '.gitignore') {
      this.logger.debug(fileOperation(uri, action));
      await this.scanIgnores();
    }
  }

  public isIgnored(file: Uri): boolean {
    const ignorer = this.ignorer(file);
    if (ignorer) {
      const relativePath = workspace.asRelativePath(file, false);

      if (relativePath.startsWith('/')) {
        return true;
      }

      try {
        return ignorer.ignores(relativePath);
      } catch (error) {
        this.logger.error(fileOperation(file, 'error', toError(error)));
        return true;
      }
    }
    return false;
  }

  public async findUnignoredFiles(pattern: string): Promise<Uri[]> {
    return workspace.findFiles(new RelativePattern(this.folder, pattern)).then(
      (files) => files.filter((file) => !this.isIgnored(file)),
      (error) => {
        this.logger.error(
          operation(`${this.folder.name}::findUnignoredFiles`, 'error', toError(error)),
        );
        return [];
      },
    );
  }
}
