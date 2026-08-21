import path from 'node:path';

import { deepDifference, deepEquals, noop } from '@technobuddha/library';
import { Diagnostic, type Disposable, Range, Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import {
  type Action,
  correspondingSource,
  fileOperation,
  globIsCss,
  globIsCssModule,
  globIsCssTypeDefinition,
  isCss,
  isCssModule,
  operation,
  type Options,
} from '../../../common/index.ts';

import {
  type ReadonlyUriMap,
  ReadonlyUriSet,
  toDiagnosticSeverity,
  UriMap,
  UriSet,
} from '../../helpers/index.ts';
import { type CodeInformation, CssInformation } from '../../information/index.ts';

import { FolderOptions, type FolderOptionsArguments } from './folder-options.ts';

export type FolderCssArguments = FolderOptionsArguments;

export abstract class FolderCss extends FolderOptions implements Disposable {
  readonly #cssInformation: UriMap<CssInformation> = new UriMap();
  readonly #updatingCssInformation: UriSet = new UriSet();

  protected async updateDiagnostics(uri: Uri): Promise<void> {
    if (isCss(uri)) {
      if (this.options.unusedClassesDiagnostics === 'none') {
        this.diagnostics.delete(uri);
        return;
      }

      if (this.openTabs.has(uri)) {
        this.logger.trace('>', fileOperation(uri, 'diagnostics'));
        const diagnostics: Diagnostic[] = [];

        const cssInfo = await this.cssInformation(uri);
        if (cssInfo) {
          const classes = new Set(cssInfo.classLocal.keys());

          await this.allCodeInformation();
          await this.allCssInformation();
          const cssImporters = this.cssFilesImporting(uri);
          const codeImporters = this.codeFilesImporting(uri);

          if (cssImporters.size === 0 && codeImporters.size === 0) {
            const diagnostic = new Diagnostic(
              new Range(0, 0, 0, 0),
              `❝${Utils.basename(uri)}❞ is not imported by any file.`,
              toDiagnosticSeverity(this.options.unusedClassesDiagnostics),
            );
            diagnostic.source = 'cmtd';
            diagnostics.push(diagnostic);
          } else {
            const infos: { uri: Uri; codeInfo: CodeInformation }[] = [];

            for (const codeUri of codeImporters) {
              await this.codeInformation(codeUri).then((codeInfo) => {
                if (codeInfo) {
                  infos.push({ uri, codeInfo });
                }
              });
            }

            for (const cssUri of cssImporters) {
              for (const codeUri of this.codeFilesImporting(cssUri)) {
                await this.codeInformation(codeUri).then((codeInfo) => {
                  if (codeInfo) {
                    infos.push({ uri: cssUri, codeInfo });
                  }
                });
              }
            }

            if (!isCssModule(uri) && infos.every(({ uri }) => !isCssModule(uri))) {
              // Css file imported only code without treating it as a CSS module
            } else {
              for (const info of infos) {
                const usages = info.codeInfo.usages.get(info.uri);
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
            }
          }
        }

        if (diagnostics.length > 0) {
          this.diagnostics.set(uri, diagnostics);
        } else {
          this.diagnostics.delete(uri);
        }
        this.logger.trace('<', fileOperation(uri, 'diagnostics'));
      }
    }
  }

  protected async updateInformation(uri: Uri, override = false): Promise<void> {
    if (isCss(uri)) {
      const oldCssInformation = this.#cssInformation.get(uri);
      const newCssInformation = await CssInformation.create({
        uri,
        logger: this.logger,
        options: this.options,
        root: this.folder.uri,
      });

      if (newCssInformation) {
        if (!deepEquals(newCssInformation, oldCssInformation)) {
          this.logger.trace(
            fileOperation(uri, 'examined'),
            ` => ${deepDifference(oldCssInformation, newCssInformation)}`,
          );

          this.#cssInformation.set(uri, newCssInformation);

          if (
            isCssModule(uri) &&
            (override || newCssInformation.hasDts || this.options.css.generateDts)
          ) {
            await newCssInformation.writeTypeDefinition(this.logger);
          }

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
    }
  }

  protected deleteInformation(uri: Uri): void {
    this.#cssInformation.delete(uri);
  }

  public override async init(): Promise<void> {
    await super.init();

    this.on('cssInformationChanged', async ({ uri }) => {
      await this.updateDiagnostics(uri);
      for (const importer of this.cssFilesImporting(uri)) {
        await this.updateDiagnostics(importer);
      }
    }).on('codeInformationChanged', async ({ newCodeInformation, oldCodeInformation }) => {
      for (const cssUri of new UriSet([
        ...(newCodeInformation?.cssImports ?? []),
        ...(oldCodeInformation?.cssImports ?? []),
      ])) {
        if (isCssModule(cssUri)) {
          await this.cssInformation(cssUri).then(async (cssInfo) => {
            await this.updateDiagnostics(cssUri);
            if (cssInfo) {
              for (const importer of cssInfo.includedFiles) {
                await this.updateDiagnostics(Uri.file(importer));
              }
            }
          });
        }
      }
    });
  }

  protected async handleIgnored(): Promise<void> {
    for (const cssFile of Array.from(this.#cssInformation.keys())) {
      if (this.isIgnored(cssFile)) {
        this.#cssInformation.delete(cssFile);
      }
    }
  }

  protected async handleOptions({
    oldOptions,
    newOptions,
  }: {
    oldOptions: Options;
    newOptions: Options;
  }): Promise<void> {
    this.logger.trace(operation(`${this.folder.name}::options`, 'changed'));
    if (deepEquals(oldOptions.css, newOptions.css)) {
      return;
    }
    this.logger.trace(operation(`${this.folder.name}::cssOptions`, 'changed'));

    for (const uri of Array.from(this.#cssInformation.keys())) {
      await this.updateCssInformation(uri);
    }
    this.logger.trace(operation(`${this.folder.name}::update`, 'changed'));
  }

  protected override async handleWatcher({
    action,
    uri,
  }: {
    action: Action;
    uri: Uri;
  }): Promise<void> {
    //#region CssModue
    if (isCss(uri)) {
      if (this.openTabs.has(uri) && !this.passTabs.has(uri)) {
        return;
      }
      this.passTabs.delete(uri);

      this.logger.debug(fileOperation(uri, action));
      if (action === 'unlink') {
        const { dir, name, ext } = path.parse(uri.fsPath);

        await this.updateCssInformation(uri);

        if (isCssModule(uri)) {
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
        }
      } else {
        await this.updateCssInformation(uri);
      }
    }
    //#endregion CssModue
    //#region Css
    if (isCss(uri)) {
      if (this.openTabs.has(uri) && !this.passTabs.has(uri)) {
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
            const newCssInformation = await CssInformation.create({
              uri,
              logger: this.logger,
              options: this.options,
              root: this.folder.uri,
            });
            if (newCssInformation) {
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
    }
    //#endregion DTS

    return super.handleWatcher({ action, uri });
  }

  public async cssInformation(uri: Uri): Promise<CssInformation | undefined> {
    return this.#cssInformation.get(uri) ?? (await this.updateCssInformation(uri));
  }

  public async allCssInformation(): Promise<ReadonlyUriMap<CssInformation>> {
    await this.findUnignoredFiles(`**/${globIsCss()}`).then(async (uris) => {
      for (const uri of uris) {
        await this.updateCssInformation(uri);
      }
    });
    return this.#cssInformation;
  }

  public abstract codeInformation(uri: Uri): Promise<CodeInformation | undefined>;
  public abstract allCodeInformation(): Promise<ReadonlyUriMap<CodeInformation>>;

  public async updateCssInformation(
    uri: Uri,
    override = false,
  ): Promise<CssInformation | undefined> {
    if (this.#updatingCssInformation.has(uri)) {
      return this.#cssInformation.get(uri);
    }
    this.#updatingCssInformation.add(uri);

    const { logger, options } = this;
    const oldCssInformation = this.#cssInformation.get(uri);
    const newCssInformation = await CssInformation.create({
      uri,
      logger,
      options,
      root: this.folder.uri,
    });

    if (newCssInformation) {
      if (!deepEquals(newCssInformation, oldCssInformation)) {
        logger.trace(
          fileOperation(uri, 'examined'),
          ` => ${deepDifference(oldCssInformation, newCssInformation)}`,
        );

        this.#cssInformation.set(uri, newCssInformation);

        if (isCssModule(uri) && (override || newCssInformation.hasDts || options.css.generateDts)) {
          await newCssInformation.writeTypeDefinition(logger);
        }

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
    this.#updatingCssInformation.delete(uri);
    return newCssInformation;
  }

  public cssFilesImporting(uri: Uri): ReadonlyUriSet {
    return new ReadonlyUriSet(
      this.#cssInformation
        .entries()
        .filter(([, info]) => info.includedFiles.has(uri.fsPath))
        .map(([importer]) => importer),
    );
  }

  public filesImporting(uri: Uri): ReadonlyUriSet {
    return new ReadonlyUriSet(
      this.#cssInformation
        .entries()
        .filter(([, info]) => info.includedFiles.has(uri.fsPath))
        .map(([importer]) => importer),
    );
  }

  public abstract codeFilesImporting(uri: Uri): ReadonlyUriSet;

  public async updateAllCssModuleTypeDefinitionFiles(): Promise<void> {
    const { logger } = this;

    const typedefs = new Set(
      (await this.findUnignoredFiles(`**/${globIsCssTypeDefinition()}`)).map((uri) => uri.fsPath),
    );

    await this.findUnignoredFiles(`**/${globIsCssModule()}`).then(async (uris) => {
      for (const uri of uris) {
        const result = await this.updateCssInformation(uri, true);
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

  public async deleteAllCssModuleTypeDefinitionFiles(): Promise<void> {
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
}
