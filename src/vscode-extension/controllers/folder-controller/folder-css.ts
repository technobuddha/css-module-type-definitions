import path from 'node:path';

import { deepDifference, deepEquals, noop } from '@technobuddha/library';
import { Diagnostic, type Disposable, Range, Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import {
  type Action,
  correspondingSource,
  fileOperation,
  globIsCssModule,
  globIsCssTypeDefinition,
  isCode,
  isCss,
  isCssGlobal,
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
import {
  type CodeInformation,
  CssGlobalInformation,
  CssModuleInformation,
} from '../../information/index.ts';

import { FolderEvent, type FolderEventArguments } from './folder-event.ts';

export type FolderCssArguments = FolderEventArguments;

export abstract class FolderCss extends FolderEvent implements Disposable {
  readonly #cssGlobalInformation: UriMap<CssGlobalInformation> = new UriMap();
  readonly #cssModuleInformation: UriMap<CssModuleInformation> = new UriMap();

  protected async updateDiagnostics(uri: Uri): Promise<void> {
    if (this.options.unusedClassesDiagnostics === 'none') {
      this.diagnostics.delete(uri);
      return;
    }

    if (isCss(uri)) {
      this.logger.trace(fileOperation(uri, 'diagnostics'));
      const diagnostics: Diagnostic[] = [];

      await this.refreshAllInformation();
      const importers = this.filesImporting(uri);

      diagnose: {
        if (importers.size === 0) {
          // A file that is not imported by any other file.

          const diagnostic = new Diagnostic(
            new Range(0, 0, 0, 0),
            `❝${Utils.basename(uri)}❞ is not imported by any file.`,
            toDiagnosticSeverity(this.options.unusedClassesDiagnostics),
          );
          diagnostic.source = 'cmtd';
          diagnostics.push(diagnostic);
          break diagnose;
        }

        // A global CSS file that is imported directly into a code file.
        if (isCssGlobal(uri) && importers.some((importer) => isCode(importer))) {
          break diagnose;
        }

        // A CSS file that is imported by a Global CSS file which is imported by a code file.
        if (
          importers.some(
            (importer) =>
              isCssGlobal(importer) &&
              this.filesImporting(importer).some((importerUri) => isCode(importerUri)),
          )
        ) {
          break diagnose;
        }

        const cssInfo = await (isCssModule(uri) ?
          this.cssModuleInformation(uri)
        : this.cssGlobalInformation(uri));
        if (cssInfo) {
          const classes = new Set(cssInfo.classNames);

          unused: {
            // A module CSS file that is imported by a code file.
            if (isCssModule(uri) && importers.some((importer) => isCode(importer))) {
              for (const importer of importers) {
                if (isCode(importer)) {
                  await this.codeInformation(importer).then((codeInfo) => {
                    if (codeInfo) {
                      const usages = codeInfo.usages.get(uri);
                      if (usages) {
                        for (const usage of usages) {
                          const classNames = (cssInfo as CssModuleInformation).localClass.get(
                            usage.localName,
                          );
                          if (classNames) {
                            for (const className of classNames) {
                              classes.delete(className);
                            }
                          }
                        }
                      }
                    }
                  });
                }
              }
            }

            // A CSS file that is imported by a Module CSS file which is imported by a code file.
            const moduleImports = Array.from(importers).filter(
              (importer) =>
                isCssModule(importer) && this.filesImporting(importer).some((file) => isCode(file)),
            );

            if (moduleImports.length > 0) {
              for (const moduleImport of moduleImports) {
                await this.cssModuleInformation(moduleImport).then(async (moduleInfo) => {
                  if (moduleInfo) {
                    for (const importer of this.filesImporting(moduleImport)) {
                      if (isCode(importer)) {
                        await this.codeInformation(importer).then((codeInfo) => {
                          if (codeInfo) {
                            const usages = codeInfo.usages.get(moduleImport);
                            if (usages) {
                              for (const usage of usages) {
                                const classNames = moduleInfo.localClass.get(usage.localName);
                                if (classNames) {
                                  for (const className of classNames) {
                                    classes.delete(className);
                                  }
                                }
                              }
                            }
                          }
                        });
                      }
                    }
                  }
                });
              }

              break unused;
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

      if (diagnostics.length > 0) {
        this.diagnostics.set(uri, diagnostics);
      } else {
        this.diagnostics.delete(uri);
      }
      this.logger.trace('<', fileOperation(uri, 'diagnostics'));
    }
  }

  protected async updateInformation(uri: Uri, override = false): Promise<void> {
    if (isCssModule(uri)) {
      const oldCssModuleInformation = this.#cssModuleInformation.get(uri);
      const newCssModuleInformation = await CssModuleInformation.create({
        uri,
        logger: this.logger,
        options: this.options,
        root: this.folder.uri,
      });

      if (newCssModuleInformation) {
        if (!deepEquals(newCssModuleInformation, oldCssModuleInformation)) {
          this.logger.trace(
            fileOperation(uri, 'examined'),
            ` => ${deepDifference(oldCssModuleInformation, newCssModuleInformation)}`,
          );

          this.#cssModuleInformation.set(uri, newCssModuleInformation);

          if (override || newCssModuleInformation.hasDts || this.options.css.generateDts) {
            await newCssModuleInformation.writeTypeDefinition(this.logger);
          }
        }
      } else {
        this.#cssModuleInformation.delete(uri);
      }
    }

    if (isCssGlobal(uri)) {
      const oldCssGlobalInformation = this.#cssGlobalInformation.get(uri);
      const newCssGlobalInformation = await CssGlobalInformation.create({
        uri,
        logger: this.logger,
        options: this.options,
      });

      if (newCssGlobalInformation) {
        if (!deepEquals(newCssGlobalInformation, oldCssGlobalInformation)) {
          this.logger.trace(
            fileOperation(uri, 'examined'),
            ` => ${deepDifference(oldCssGlobalInformation, newCssGlobalInformation)}`,
          );

          this.#cssGlobalInformation.set(uri, newCssGlobalInformation);
        }
      } else {
        this.#cssGlobalInformation.delete(uri);
      }
    }
  }

  protected async refreshInformation(uri: Uri): Promise<void> {
    if (isCssModule(uri)) {
      if (!this.#cssModuleInformation.has(uri)) {
        return this.updateInformation(uri);
      }
      return;
    }

    if (isCssGlobal(uri)) {
      if (!this.#cssGlobalInformation.has(uri)) {
        return this.updateInformation(uri);
      }
    }
  }

  protected deleteInformation(uri: Uri): void {
    this.#cssModuleInformation.delete(uri);
    this.#cssGlobalInformation.delete(uri);
  }

  //#region Event Handlers
  protected async handleEditTab(uri: Uri): Promise<void> {
    if (isCss(uri)) {
      this.logger.debug(fileOperation(uri, 'edited'));

      const importers = this.filesImporting(uri);
      for (const importer of Array.from(importers)) {
        if (isCss(importer)) {
          const cssImporters = this.filesImporting(uri);
          for (const cssImporter of cssImporters) {
            if (isCode(cssImporter)) {
              importers.add(cssImporter);
            }
          }
        }
      }

      await this.updateInformation(uri);
      for (const importer of importers) {
        await this.updateInformation(importer);
      }

      await this.updateDiagnostics(uri);
      for (const importer of importers) {
        await this.updateDiagnostics(importer);
      }
    }
  }

  protected async handleIgnored(): Promise<void> {
    for (const cssModule of Array.from(this.#cssModuleInformation.keys())) {
      if (this.isIgnored(cssModule)) {
        this.#cssModuleInformation.delete(cssModule);
      }
    }

    for (const css of Array.from(this.#cssGlobalInformation.keys())) {
      if (this.isIgnored(css)) {
        this.#cssGlobalInformation.delete(css);
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

    for (const cssModule of Array.from(this.#cssModuleInformation.keys())) {
      await this.updateInformation(cssModule);
    }
    for (const css of Array.from(this.#cssGlobalInformation.keys())) {
      await this.updateInformation(css);
    }
  }

  protected override async handleWatcher({
    action,
    uri,
  }: {
    action: Action;
    uri: Uri;
  }): Promise<void> {
    //#region Css
    if (isCss(uri)) {
      if (this.openTabs.has(uri) && !this.passTabs.has(uri)) {
        return;
      }
      this.passTabs.delete(uri);

      this.logger.debug(fileOperation(uri, action));
      if (action === 'unlink') {
        await this.updateInformation(uri);

        if (isCssModule(uri)) {
          const { dir, name, ext } = path.parse(uri.fsPath);
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
        await this.updateInformation(uri);
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
      for (const [file, { importedFiles }] of this.#cssModuleInformation) {
        if (importedFiles.has(uri)) {
          await this.updateDiagnostics(file);
        }
      }
    }
    //#endregion Css
    //#region DTS
    const cssFile = correspondingSource(uri);
    if (cssFile) {
      this.logger.debug(fileOperation(uri, action));
      const oldCssModuleInformation = this.#cssModuleInformation.get(cssFile);
      if (oldCssModuleInformation) {
        if (action === 'add' || action === 'unlink') {
          const hasDts = action === 'add';

          if (oldCssModuleInformation.hasDts !== hasDts) {
            const newCssModuleInformation = await CssModuleInformation.create({
              uri,
              logger: this.logger,
              options: this.options,
              root: this.folder.uri,
            });
            if (newCssModuleInformation) {
              newCssModuleInformation.hasDts = hasDts;
              this.#cssModuleInformation.set(cssFile, newCssModuleInformation);
            }
          }
        }
      }
    }
    //#endregion DTS

    return super.handleWatcher({ action, uri });
  }
  //#endregion Event Handlers

  public async cssGlobalInformation(uri: Uri): Promise<CssGlobalInformation | undefined> {
    const cssGlobalInfo = this.#cssGlobalInformation.get(uri);
    if (cssGlobalInfo) {
      return cssGlobalInfo;
    }

    await this.updateInformation(uri);
    return this.#cssGlobalInformation.get(uri);
  }

  public async cssModuleInformation(uri: Uri): Promise<CssModuleInformation | undefined> {
    const cssModuleInfo = this.#cssModuleInformation.get(uri);
    if (cssModuleInfo) {
      return cssModuleInfo;
    }

    await this.updateInformation(uri);
    return this.#cssModuleInformation.get(uri);
  }

  public abstract codeInformation(uri: Uri): Promise<CodeInformation | undefined>;
  public abstract allCodeInformation(): Promise<ReadonlyUriMap<CodeInformation>>;

  public cssFilesImporting(uri: Uri): ReadonlyUriSet {
    return new ReadonlyUriSet(
      this.#cssModuleInformation
        .entries()
        .filter(([, info]) => info.importedFiles.has(uri))
        .map(([importer]) => importer),
    );
  }

  public filesImporting(uri: Uri): UriSet {
    return new UriSet(
      this.#cssModuleInformation
        .entries()
        .filter(([, info]) => info.importedFiles.has(uri))
        .map(([importer]) => importer),
      this.#cssGlobalInformation
        .entries()
        .filter(([, info]) => info.importedFiles.has(uri))
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
        await this.updateInformation(uri, true);
        const result = await this.cssModuleInformation(uri);
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
