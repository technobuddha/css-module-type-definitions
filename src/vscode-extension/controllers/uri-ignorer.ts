import { isWithinDirectory, pathDepth } from '@technobuddha/library';
import ignore, { type Ignore } from 'ignore';
import { type Disposable, RelativePattern, workspace, type WorkspaceFolder } from 'vscode';
import { type URI, Utils } from 'vscode-uri';

import { fileOperation, Ignorer, type Logger } from '../../common/index.ts';

type UriIgnorerOptions = {
  folder: WorkspaceFolder;
  logger: Logger;
  watch: boolean;
};

export class UriIgnorer extends Ignorer<URI> implements Disposable {
  protected readonly folder: WorkspaceFolder;
  protected readonly ignores: Map<URI, Ignore> = new Map();

  public static async create({ folder, logger, watch }: UriIgnorerOptions): Promise<UriIgnorer> {
    const ignorer = new UriIgnorer({ folder, logger, watch });

    await Ignorer.init(ignorer);
    await ignorer.scanIgnores();

    return ignorer;
  }

  private constructor({ folder, logger, watch }: Required<UriIgnorerOptions>) {
    super({ root: folder.uri.fsPath, logger, watch });
    this.folder = folder;
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

  protected toFilename(uri: URI): string {
    return uri.fsPath;
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
