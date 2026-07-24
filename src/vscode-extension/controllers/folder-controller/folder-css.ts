import path from 'node:path';

import { toError } from '@technobuddha/library';
import { type Disposable, Uri, workspace, type WorkspaceFolder } from 'vscode';

import { fileOperation, type LoggerController } from '../../../common/index.ts';
import { generateTypesFromCss } from '../../../css-library/index.ts';

import { CssInformation } from '../../css-information/index.ts';

import { FolderOptions } from './folder-options.ts';

type FolderCssOptions = {
  folder: WorkspaceFolder;
  logger: LoggerController;
};

export class FolderCss extends FolderOptions implements Disposable {
  protected readonly cssInformation: Map<string, CssInformation> = new Map();

  public constructor({ folder, logger }: FolderCssOptions) {
    super({ folder, logger });

    this.eventTarget.addEventListener('options', async () => {
      await this.updateCssTypeDefinitions();
    });
    this.eventTarget.addEventListener('ignored', async () => {
      await this.updateCssTypeDefinitions();
    });

    this.eventTarget.addEventListener('watcher', async ({ detail: { action, uri } }) => {
      if (this.isCssModule(uri)) {
        this.logger.debug(fileOperation(uri.fsPath, action));
        if (action === 'unlink') {
          await this.deleteCssInformation(uri);
        } else {
          this.cssInformation.delete(uri.fsPath);
          await this.getCssInformation(uri).then(async (cssInfo) => {
            if (cssInfo && this.options.css.generateDts) {
              return cssInfo.writeTypeDefinitionFiles(this.logger);
            }
          });
        }
        return;
      }

      if (this.isCss(uri)) {
        this.logger.debug(fileOperation(uri.fsPath, action));
        for (const [file, { includedFiles }] of this.cssInformation) {
          if (includedFiles.has(uri.fsPath)) {
            this.cssInformation.delete(file);
            await this.getCssInformation(Uri.file(file)).then(async (cssInfo) => {
              if (cssInfo && this.options.css.generateDts) {
                return cssInfo.writeTypeDefinitionFiles(this.logger);
              }
            });
          }
        }
      }
    });
  }

  public async getCssInformation(uri: Uri): Promise<CssInformation | undefined> {
    if (this.cssInformation.has(uri.fsPath)) {
      return this.cssInformation.get(uri.fsPath)!;
    }

    const { logger, options } = this;

    if (this.isCssModule(uri) && !this.isIgnored(uri)) {
      try {
        const result = await workspace.fs
          .readFile(uri)
          .then(workspace.decode)
          .then(async (content) => generateTypesFromCss(content, uri.fsPath, { options, logger }))
          .then((cssInfo) => new CssInformation(cssInfo));

        if (result) {
          this.cssInformation.set(uri.fsPath, result);
          return result;
        }

        this.cssInformation.delete(uri.fsPath);
        return undefined;
      } catch (e) {
        logger.error(toError(e), ' <== from folder-css');
      }
    }
    return undefined;
  }

  public async updateCssTypeDefinitions(): Promise<void> {
    const { logger, options } = this;

    this.cssInformation.clear();

    const typedefs = new Set(
      (await this.findUnignoredFiles(`**/${this.globIsTypeDefinition()}`)).map((uri) => uri.fsPath),
    );

    await this.findUnignoredFiles(`**/${this.globIsCssModule()}`).then(async (uris) => {
      for (const uri of uris) {
        const result = await this.getCssInformation(uri);
        if (result) {
          if (options.css.generateDts) {
            await result.writeTypeDefinitionFiles(logger);

            for (const file of Object.keys(result.files)) {
              typedefs.delete(file);
            }
          }
        }
      }
    });

    for (const pathname of typedefs) {
      await workspace.fs.delete(Uri.parse(pathname));
      logger.info(fileOperation(pathname, 'deleted'));
    }
  }

  public async getAllCssInformation(): Promise<ReadonlyMap<string, CssInformation>> {
    await this.findUnignoredFiles(`**/${this.globIsCssModule()}`).then(async (uris) => {
      for (const uri of uris) {
        await this.getCssInformation(uri);
      }
    });
    return this.cssInformation;
  }

  public async deleteCssInformation(uri: Uri): Promise<void> {
    const { dir, name, ext } = path.parse(uri.fsPath);

    this.cssInformation.delete(uri.fsPath);

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

  public async deleteAllCssInformation(): Promise<void> {
    await this.findUnignoredFiles(`**/${this.globIsCssModule()}`).then(async (uris) => {
      for (const uri of uris) {
        await this.deleteCssInformation(uri);
      }
    });
    await this.findUnignoredFiles(`**/${this.globIsTypeDefinition()}`).then(async (uris) => {
      for (const uri of uris) {
        await workspace.fs.delete(uri);
        this.logger.info(fileOperation(uri.fsPath, 'deleted'));
      }
    });
  }

  public async importers(uri: Uri): Promise<Uri[]> {
    return this.isCssModule(uri) ?
        [uri]
      : this.getAllCssInformation().then((imports) =>
          imports
            .entries()
            .filter(([, info]) => info.includedFiles.has(uri.fsPath))
            .map(([importer]) => Uri.file(importer))
            .toArray(),
        );
  }
}
