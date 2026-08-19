import os from 'node:os';
import path from 'node:path';

import { deepEquals, noop } from '@technobuddha/library';
import { Diagnostic, type Disposable, Range, Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import {
  correspondingSource,
  fileOperation,
  globIsCssModule,
  globIsCssTypeDefinition,
  isCss,
  isCssModule,
  operation,
} from '../../../common/index.ts';
import { cssImporter, generateTypesFromCss } from '../../../css-library/index.ts';

import { type CodeInformation } from '../../code-information/index.ts';
import { CssInformation } from '../../css-information/index.ts';
import { type ReadonlyUriMap, toDiagnosticSeverity, UriMap, UriSet } from '../../helpers/index.ts';

import { FolderOptions, type FolderOptionsArguments } from './folder-options.ts';

export type FolderCssArguments = FolderOptionsArguments;

export abstract class FolderCss extends FolderOptions implements Disposable {
  readonly #cssInformation: UriMap<CssInformation> = new UriMap();

  protected async updateDiagnostics(uri: Uri): Promise<void> {
    if (isCssModule(uri) && this.openTabs.has(uri)) {
      if (this.options.unusedClassesDiagnostics === 'none') {
        this.diagnostics.delete(uri);
        return;
      }

      if (this.openTabs.has(uri)) {
        this.logger.trace(fileOperation(uri, 'diagnostics'));

        const cssInfo = await this.cssInformation(uri);
        if (cssInfo) {
          const classes = new Set(cssInfo.classLocal.keys());

          for (const codeInfo of await this.codeInformationForCssModule(uri)) {
            const usages = codeInfo.usages.get(uri);
            if (usages) {
              for (const usage of usages) {
                const classNames = cssInfo.localClass.get(usage.localName);
                if (classNames) {
                  for (const className of classNames) {
                    classes.delete(className);
                  }
                }
              }
            }
          }

          if (classes.size > 0) {
            const diagnostics: Diagnostic[] = [];
            for (const className of classes) {
              const locations = cssInfo.locationsOfClass.get(className);
              if (locations) {
                for (const { location } of locations) {
                  let range: Range;
                  let message: string;

                  if (uri.fsPath === Uri.joinPath(Utils.dirname(uri), location.source).fsPath) {
                    range = new Range(
                      location.range.start.line,
                      location.range.start.column,
                      location.range.end.line,
                      location.range.end.column,
                    );
                    message = `Class "${className}" is not used.`;
                  } else {
                    if (!this.options.unusedImportedClassesDiagnostics) {
                      continue;
                    }

                    range = new Range(0, 0, 0, 0);
                    message = `Class "${className}" imported from "${location.source}" is not used.`;
                  }

                  const diagnostic = new Diagnostic(
                    range,
                    message,
                    toDiagnosticSeverity(this.options.unusedClassesDiagnostics),
                  );
                  diagnostic.source = 'cmtd';
                  diagnostics.push(diagnostic);
                }
              }
            }
            if (diagnostics.length > 0) {
              this.diagnostics.set(uri, diagnostics);
            } else {
              this.diagnostics.delete(uri);
            }
          } else {
            this.diagnostics.delete(uri);
          }
        }
      }
    }
  }

  public override async init(): Promise<void> {
    await super.init();

    this.on('options', async ({ oldOptions, newOptions }) => {
      this.logger.trace(operation(`${this.folder.name}::options`, 'changed'));
      if (deepEquals(oldOptions.css, newOptions.css)) {
        return;
      }
      this.logger.trace(operation(`${this.folder.name}::cssOptions`, 'changed'));

      for (const uri of Array.from(this.#cssInformation.keys())) {
        await this.updateCssInformationAndWriteTypeDefinitions(uri).then(async (cssInfo) => {
          if (cssInfo) {
            await this.updateDiagnostics(uri);
          }
        });
      }
      this.logger.trace(operation(`${this.folder.name}::update`, 'changed'));
    })
      .on('ignored', async () => {
        for (const cssFile of Array.from(this.#cssInformation.keys())) {
          if (this.isIgnored(cssFile)) {
            await this.updateCssInformation(cssFile);
          }
        }
      })
      .on('watcher', async ({ action, uri }) => {
        //#region CssModue
        if (isCssModule(uri)) {
          if (this.openTabs.has(uri) && !this.passTabs.has(uri)) {
            this.logger.trace(fileOperation(uri, `omit-${action}`));
            return;
          }
          this.passTabs.delete(uri);

          this.logger.debug(fileOperation(uri, action));
          if (action === 'unlink') {
            const { dir, name, ext } = path.parse(uri.fsPath);

            await this.updateCssInformation(uri);

            for (const file of [
              `${dir}/${name}.d${ext}.ts`,
              `${dir}/${name}${ext}.d.ts`,
              `${dir}/${name}${ext}.map`,
              `${dir}/${name}.d${ext}.ts.map`,
              `${dir}/${name}${ext}.d.ts.map`,
            ]) {
              const generatedUri = uri.with({ path: file });
              await workspace.fs.delete(generatedUri).then(() => {
                this.logger.debug(fileOperation(generatedUri, 'deleted'));
              }, noop);
            }
          } else {
            await this.updateCssInformation(uri).then(async (cssInfo) => {
              if (cssInfo && this.options.css.generateDts) {
                await cssInfo.writeTypeDefinitionFiles(this.logger);
              }
            });
          }
        }
        //#endregion CssModue
        //#region Css
        if (isCss(uri)) {
          if (this.openTabs.has(uri) && !this.passTabs.has(uri)) {
            this.logger.trace(fileOperation(uri, `omit-${action}`));
            return;
          }
          this.passTabs.delete(uri);

          this.logger.debug(fileOperation(uri, action));
          for (const [file, { includedFiles }] of this.#cssInformation) {
            if (includedFiles.has(uri.fsPath)) {
              await this.updateDiagnostics(file);
            }
          }
        }
        //#endregion Css
        //#region DTS
        const cssFile = correspondingSource(uri);
        if (cssFile) {
          this.logger.debug(fileOperation(uri, action));
          const oldCssInformation = this.#cssInformation.get(cssFile);
          if (oldCssInformation) {
            if (action === 'add' || action === 'unlink') {
              const hasDts = action === 'add';

              if (oldCssInformation.hasDts !== hasDts) {
                const newCssInformation = new CssInformation(oldCssInformation);
                newCssInformation.hasDts = hasDts;
                this.#cssInformation.set(cssFile, newCssInformation);
                await this.fire('cssInformationChanged', {
                  uri: cssFile,
                  oldCssInformation,
                  newCssInformation,
                });
              }
            }
          }
        }
        //#endregion DTS
      })
      .on('openTab', async (uri) => {
        if (isCssModule(uri)) {
          this.logger.debug(fileOperation(uri, 'opened'));
          await this.updateCssInformation(uri);
        }
      })
      .on('editTab', async (uri) => {
        if (isCssModule(uri)) {
          this.logger.debug(fileOperation(uri, 'edited'));
          await this.updateCssInformation(uri);
        }
      })
      .on('closeTab', async (uri) => {
        if (isCssModule(uri)) {
          this.logger.debug(fileOperation(uri, 'closed'));
          this.diagnostics.delete(uri);
          await this.updateCssInformation(uri);
        }
      })
      .on('cssInformationChanged', async ({ uri }) => {
        await this.updateDiagnostics(uri);
      })
      .on('codeInformationChanged', async ({ newCodeInformation, oldCodeInformation }) => {
        for (const uri of new UriSet([
          ...(newCodeInformation?.cssModuleImports ?? []),
          ...(oldCodeInformation?.cssModuleImports ?? []),
        ])) {
          await this.updateDiagnostics(uri);
        }
      });
  }

  protected abstract codeInformationForCssModule(uri: Uri): Promise<CodeInformation[]>;

  public async updateCssInformation(uri: Uri): Promise<CssInformation | undefined> {
    const { logger, options } = this;
    const oldCssInformation = this.#cssInformation.get(uri);

    const newCssInformation =
      isCssModule(uri) && !this.isIgnored(uri) ?
        await workspace.openTextDocument(uri).then(
          async (document) =>
            generateTypesFromCss(document.getText(), uri.fsPath, {
              options,
              logger,
              cssImporter: cssImporter({ root: Utils.dirname(uri), logger }),
              relativeTo: os.homedir(),
              root: this.folder.uri.fsPath,
            }).then((cssInfo) => new CssInformation(cssInfo)),
          noop,
        )
      : undefined;

    if (newCssInformation) {
      if (!deepEquals(newCssInformation, oldCssInformation)) {
        logger.trace(fileOperation(uri, 'examined'));
        this.#cssInformation.set(uri, newCssInformation);
        await this.fire('cssInformationChanged', { uri, oldCssInformation, newCssInformation });
      }
    } else {
      this.#cssInformation.delete(uri);
      if (oldCssInformation) {
        await this.fire('cssInformationChanged', {
          uri,
          oldCssInformation,
          newCssInformation: undefined,
        });
      }
    }
    return newCssInformation;
  }

  public async updateCssInformationAndWriteTypeDefinitions(
    uri: Uri,
    override = false,
  ): Promise<CssInformation | undefined> {
    return this.updateCssInformation(uri).then(async (cssInfo) => {
      if (cssInfo && (override || this.options.css.generateDts)) {
        await cssInfo.writeTypeDefinitionFiles(this.logger);
      }
      return cssInfo;
    });
  }

  public async cssInformation(uri: Uri): Promise<CssInformation | undefined> {
    if (this.#cssInformation.has(uri)) {
      return this.#cssInformation.get(uri);
    }

    return this.updateCssInformation(uri);
  }

  public cssInformationForImportedFile(uri: Uri): CssInformation[] | undefined {
    const result: CssInformation[] = [];
    for (const cssInfo of this.#cssInformation.values()) {
      if (cssInfo.includedFiles.has(uri.fsPath)) {
        result.push(cssInfo);
      }
    }
    return result.length > 0 ? result : undefined;
  }

  public async updateCssTypeDefinitions(): Promise<void> {
    const { logger } = this;

    const typedefs = new Set(
      (await this.findUnignoredFiles(`**/${globIsCssTypeDefinition()}`)).map((uri) => uri.fsPath),
    );

    await this.findUnignoredFiles(`**/${globIsCssModule()}`).then(async (uris) => {
      for (const uri of uris) {
        const result = await this.updateCssInformationAndWriteTypeDefinitions(uri, true);
        if (result) {
          typedefs.delete(result.dtsFilename);
        }
      }
    });

    for (const pathname of typedefs) {
      await workspace.fs.delete(Uri.parse(pathname));
      logger.info(fileOperation(pathname, 'deleted'));
    }
  }

  public async getAllCssInformation(): Promise<ReadonlyUriMap<CssInformation>> {
    await this.findUnignoredFiles(`**/${globIsCssModule()}`).then(async (uris) => {
      for (const uri of uris) {
        await this.updateCssInformation(uri);
      }
    });
    return this.#cssInformation;
  }

  public async deleteAllDts(): Promise<void> {
    await this.findUnignoredFiles(`**/${globIsCssTypeDefinition()}`).then(async (uris) => {
      for (const uri of uris) {
        await workspace.fs.delete(uri).then(
          () => {
            this.logger.info(fileOperation(uri, 'deleted'));
          },
          (error) => {
            this.logger.error(fileOperation(uri, 'error', error));
          },
        );
      }
    });
  }

  public async cssImporters(uri: Uri): Promise<Uri[]> {
    return isCssModule(uri) ?
        [uri]
      : this.getAllCssInformation().then((imports) =>
          imports
            .entries()
            .filter(([, info]) => info.includedFiles.has(uri.fsPath))
            .map(([importer]) => importer)
            .toArray(),
        );
  }
}
