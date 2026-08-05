import path from 'node:path';

import { toError } from '@technobuddha/library';
import { type Disposable, Uri, workspace } from 'vscode';

import {
  correspondingSource,
  fileOperation,
  globIsCssModule,
  globIsCssTypeDefinition,
  isCss,
  isCssModule,
} from '../../../common/index.ts';
import { generateTypesFromCss } from '../../../css-library/index.ts';

import { CssInformation } from '../../css-information/index.ts';

import { FolderOptions, type FolderOptionsArguments } from './folder-options.ts';

export type FolderCssArguments = FolderOptionsArguments;

export abstract class FolderCss extends FolderOptions implements Disposable {
  protected readonly cssInformation: Map<string, CssInformation> = new Map();

  public constructor({ workspaceController, folder }: FolderCssArguments) {
    super({ workspaceController, folder });

    this.eventTarget.addEventListener('options', async () => {
      await this.updateCssTypeDefinitions();
    });

    this.eventTarget.addEventListener('ignored', async () => {
      for (const cssFile of Array.from(this.cssInformation.keys())) {
        if (this.isIgnored(Uri.file(cssFile))) {
          this.cssInformation.delete(cssFile);
          await this.onCssInformationChanged(Uri.file(cssFile));
        }
      }
    });

    this.eventTarget.addEventListener('watcher', async ({ detail: { action, uri } }) => {
      if (isCssModule(uri)) {
        this.logger.debug(fileOperation(uri.fsPath, action));
        if (action === 'unlink') {
          await this.deleteCss(uri);
        } else {
          await this.getCssInformation(uri, false).then(async (cssInfo) => {
            if (cssInfo && this.options.css.generateDts) {
              return cssInfo.writeTypeDefinitionFiles(this.logger);
            }
          });
        }
        return;
      }

      if (isCss(uri)) {
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
        return;
      }

      const dtsFile = correspondingSource(uri);
      if (dtsFile) {
        const cssInfo = this.cssInformation.get(dtsFile.fsPath);
        if (cssInfo) {
          if (action === 'add' || action === 'unlink') {
            this.logger.debug(fileOperation(uri.fsPath, action));
            cssInfo.hasDts = action === 'add';
            await this.onCssInformationChanged(dtsFile);
          }
        }
      }
    });
  }

  protected async deleteCss(uri: Uri): Promise<void> {
    const { dir, name, ext } = path.parse(uri.fsPath);

    this.cssInformation.delete(uri.fsPath);
    await this.onCssInformationChanged(uri);

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

  protected abstract onCssInformationChanged(_uri: Uri): Promise<void>;

  public async getCssInformation(uri: Uri, useCache = true): Promise<CssInformation | undefined> {
    if (useCache && this.cssInformation.has(uri.fsPath)) {
      return this.cssInformation.get(uri.fsPath)!;
    }

    const { logger, options } = this;

    if (isCssModule(uri) && !this.isIgnored(uri)) {
      try {
        const cssInfo = await workspace.fs
          .readFile(uri)
          .then(workspace.decode)
          .then(async (content) => generateTypesFromCss(content, uri.fsPath, { options, logger }))
          .then((cssInfo) => new CssInformation(cssInfo));

        if (cssInfo) {
          this.cssInformation.set(uri.fsPath, cssInfo);
          await this.onCssInformationChanged(uri);
          return cssInfo;
        }

        this.cssInformation.delete(uri.fsPath);
        await this.onCssInformationChanged(uri);
        return undefined;
      } catch (e) {
        logger.error(toError(e));
      }
    }
    return undefined;
  }

  public async updateCssTypeDefinitions(): Promise<void> {
    const { logger, options } = this;

    this.cssInformation.clear();

    const typedefs = new Set(
      (await this.findUnignoredFiles(`**/${globIsCssTypeDefinition()}`)).map((uri) => uri.fsPath),
    );

    await this.findUnignoredFiles(`**/${globIsCssModule()}`).then(async (uris) => {
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
    await this.findUnignoredFiles(`**/${globIsCssModule()}`).then(async (uris) => {
      for (const uri of uris) {
        await this.getCssInformation(uri);
      }
    });
    return this.cssInformation;
  }

  public async deleteAllCssDts(): Promise<void> {
    await this.findUnignoredFiles(`**/${globIsCssTypeDefinition()}`).then(async (uris) => {
      for (const uri of uris) {
        try {
          await workspace.fs.delete(uri);
          this.logger.info(fileOperation(uri.fsPath, 'deleted'));
        } catch {
          this.logger.warn(fileOperation(uri.fsPath, 'deleted'));
        }
      }
    });
  }

  public async importers(uri: Uri): Promise<Uri[]> {
    return isCssModule(uri) ?
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
