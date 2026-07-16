import { type Disposable, Uri, type WorkspaceFolder } from 'vscode';
import { Utils } from 'vscode-uri';

import { CODE_EXTENSIONS, fileOperation, type LoggerController } from '../../../common/index.ts';

import { scanImports } from '../../providers/helpers/scan-imports.ts';

import { FolderCss } from './folder-css.ts';

type FolderCodeOptions = {
  folder: WorkspaceFolder;
  logger: LoggerController;
};

const reDts = /(?:\.d\.ts$)|(?:\.d\.[^.]*\.ts$)/v;

export class FolderCode extends FolderCss implements Disposable {
  public readonly imports: Map<string, Uri[]> = new Map();

  public constructor({ folder, logger }: FolderCodeOptions) {
    super({ folder, logger });

    this.eventTarget.addEventListener('watcher', async ({ detail: { action, uri } }) => {
      if (this.isCode(uri)) {
        this.logger.debug(fileOperation(uri.fsPath, action));

        if (action === 'unlink') {
          this.deleteImports(uri);
        } else {
          await this.getImports(uri, false);
        }
      }
    });

    this.eventTarget.addEventListener('ignored', () => {
      this.deleteIgnoredImports();
    });
  }

  public async getImports(uri: Uri, cache = true): Promise<Uri[] | undefined> {
    if (cache && this.imports.has(uri.fsPath)) {
      return this.imports.get(uri.fsPath)!;
    }

    if (this.isCode(uri) && !this.isIgnored(uri)) {
      const result = await scanImports(uri)
        .then((uris) => uris.filter((u) => this.isCssModule(u)))
        .catch(() => []);
      this.imports.set(uri.fsPath, result);
      return result;
    }
    return undefined;
  }

  public async getAllImports(): Promise<void> {
    await this.findUnignoredFiles(`**/${this.globIsCode()}`).then(async (uris) => {
      for (const uri of uris) {
        if (this.isCode(uri)) {
          await this.getImports(uri, false);
        }
      }
    });
  }

  public deleteImports(uri: Uri): void {
    this.imports.delete(uri.fsPath);
  }

  public deleteIgnoredImports(): void {
    for (const file of Array.from(this.imports.keys())) {
      if (this.isIgnored(Uri.file(file))) {
        this.imports.delete(file);
      }
    }
  }

  public isCode(uri: Uri): boolean {
    return (
      CODE_EXTENSIONS.includes(Utils.extname(uri) as (typeof CODE_EXTENSIONS)[number]) &&
      !reDts.test(uri.fsPath)
    );
  }

  public globIsCode(): string {
    return `*{${CODE_EXTENSIONS.join(',')}}`;
  }
}
