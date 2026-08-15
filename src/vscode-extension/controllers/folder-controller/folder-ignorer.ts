import { empty, isWithinDirectory, pathDepth, toError } from '@technobuddha/library';
import ignore, { type Ignore } from 'ignore';
import { type Disposable, RelativePattern, type Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import { fileOperation } from '../../../common/index.ts';

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

    return workspace
      .findFiles(new RelativePattern(this.folder, '**/.gitignore'))
      .then(async (files) => {
        for (const file of files.sort((a, b) => pathDepth(a.fsPath) - pathDepth(b.fsPath))) {
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
          } catch (error) {
            this.logger.error(toError(error), `Failed to read ignore file: ${file}`);
          }
        }

        await this.fire('ignored');
      });
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

  public override async init(): Promise<void> {
    await super.init();

    await this.scanned;

    this.on('watcher', async ({ action, uri }) => {
      if (Utils.basename(uri) === '.gitignore') {
        this.logger.debug(fileOperation(uri.fsPath, action));
        await this.scanIgnores();
      }
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
