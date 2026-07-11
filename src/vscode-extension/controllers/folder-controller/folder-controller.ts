import path from 'node:path';

import { toError } from '@technobuddha/library';
import { type Disposable, Uri, workspace, type WorkspaceFolder } from 'vscode';

import { fileOperation, type LoggerController } from '../../../common/index.ts';
import { type CssInfo, generateTypesFromCss } from '../../../css-library/index.ts';

import { FolderOptions } from './folder-options.ts';

type FolderControllerOptions = {
  folder: WorkspaceFolder;
  logger: LoggerController;
};

export class FolderController extends FolderOptions implements Disposable {
  public static async create({
    folder,
    logger,
  }: FolderControllerOptions): Promise<FolderController> {
    const controller = new FolderController({ folder, logger });

    await super.init(controller);
    return controller;
  }

  readonly #types: Map<string, CssInfo> = new Map();

  public constructor({ folder, logger }: FolderControllerOptions) {
    super({ folder, logger });

    this.eventTarget.addEventListener('options', async () => {
      this.logger.debug('>>>>OPTIONS');
      await this.getAllTypes();
    });
    this.eventTarget.addEventListener('ignored', async () => {
      this.logger.debug('>>>>IGNORED');
      await this.getAllTypes();
    });

    this.eventTarget.addEventListener('watcher', async ({ detail: { action, uri } }) => {
      if (this.isCssModule(uri)) {
        this.logger.debug(fileOperation(uri.fsPath, action));
        if (action === 'unlink') {
          await this.deleteTypes(uri);
        } else {
          await this.getTypes(uri, false);
        }
        return;
      }

      if (this.isCss(uri)) {
        this.logger.debug(fileOperation(uri.fsPath, action));
        for (const [file, { includedFiles }] of this.#types) {
          if (includedFiles.has(uri.fsPath)) {
            await this.getTypes(Uri.parse(file), false);
          }
        }
      }
    });
  }

  public async getTypes(uri: Uri, cache = true): Promise<CssInfo | undefined> {
    if (cache && this.#types.has(uri.fsPath)) {
      return this.#types.get(uri.fsPath)!;
    }

    const { logger, options } = this;

    if (this.isCssModule(uri) && !this.isIgnored(uri)) {
      try {
        const result = await workspace.fs
          .readFile(uri)
          .then(workspace.decode)
          .then(async (content) => generateTypesFromCss(content, uri.fsPath, { options, logger }));

        if (result) {
          if (options.cssModules.generateDts) {
            const { files } = result;
            await Promise.all(
              Object.entries(files).map(async ([filename, content]) => {
                const fileUri = uri.with({ path: filename });

                try {
                  await workspace.fs
                    .readFile(fileUri)
                    .then(workspace.decode)
                    .then(async (existingContent) => {
                      if (existingContent !== content) {
                        await workspace.fs.writeFile(fileUri, await workspace.encode(content));
                        logger.info(fileOperation(filename, 'updated'));
                      }
                    });
                } catch (e) {
                  const error = toError(e);
                  if (error.code === 'FileNotFound') {
                    await workspace.fs.writeFile(fileUri, await workspace.encode(content));
                    logger.info(fileOperation(filename, 'created'));
                  } else {
                    logger.error(error, `Failed to read file ${fileUri.fsPath}`);
                  }
                }
              }),
            );
          }

          this.#types.set(uri.fsPath, result);
          return result;
        }
        this.#types.delete(uri.fsPath);
        return undefined;
      } catch (e) {
        logger.error(toError(e));
      }
    }
    return undefined;
  }

  public async getAllTypes(): Promise<void> {
    const { logger, options } = this;

    const typedefs = new Set(
      (await this.findUnignoredFiles(`**/${this.globIsTypeDefinition()}`)).map((uri) => uri.fsPath),
    );

    await this.findUnignoredFiles(`**/${this.globIsCssModule()}`).then(async (uris) => {
      for (const uri of uris) {
        const result = await this.getTypes(uri, false);
        if (result && options.cssModules.generateDts) {
          for (const file of Object.keys(result.files)) {
            typedefs.delete(file);
          }
        }
      }
    });

    for (const pathname of typedefs) {
      await workspace.fs.delete(Uri.parse(pathname));
      logger.info(fileOperation(pathname, 'deleted'));
    }
  }

  public async deleteTypes(uri: Uri): Promise<void> {
    const { dir, name, ext } = path.parse(uri.fsPath);

    this.#types.delete(uri.fsPath);

    for (const file of [
      `${name}.d${ext}.ts`,
      `${name}${ext}.d.ts`,
      `${name}${ext}.map`,
      `${name}.d${ext}.ts.map`,
      `${name}${ext}.d.ts.map`,
    ]) {
      const generatedUri = uri.with({ path: path.join(dir, file) });
      try {
        await workspace.fs.delete(generatedUri).then(() => {
          this.logger.debug(fileOperation(generatedUri.fsPath, 'deleted'));
        });
      } catch {}
    }
  }

  public async deleteAllTypes(): Promise<void> {
    await this.findUnignoredFiles(`**/${this.globIsCssModule()}`).then(async (uris) => {
      for (const uri of uris) {
        await this.deleteTypes(uri);
      }
    });
    await this.findUnignoredFiles(`**/${this.globIsTypeDefinition()}`).then(async (uris) => {
      for (const uri of uris) {
        await workspace.fs.delete(uri);
        this.logger.info(fileOperation(uri.fsPath, 'deleted'));
      }
    });
  }
}
