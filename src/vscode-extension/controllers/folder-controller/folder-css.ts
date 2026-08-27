import path from 'node:path';

import { conjoin, deepEquals, noop, toArray, toIterable } from '@technobuddha/library';
import { type SetOptional } from 'type-fest';
import { type Command, Diagnostic, type Disposable, Range, Uri, workspace } from 'vscode';
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
  type CssInformation,
  CssModuleInformation,
} from '../../information/index.ts';

import { FolderEvent, type FolderEventArguments } from './folder-event.ts';

export type FolderCssArguments = FolderEventArguments;

type CssCommand = SetOptional<Omit<Command, 'command'>, 'tooltip'> & { icon?: string };

export abstract class FolderCss extends FolderEvent implements Disposable {
  readonly #cssInformation: UriMap<CssInformation> = new UriMap();
  readonly #commands: UriMap<CssCommand> = new UriMap();

  protected async updateDiagnostics(uri: Uri): Promise<void> {
    if (isCss(uri)) {
      if (this.options.unusedClassesDiagnostics === 'none') {
        this.diagnostics.delete(uri);
        return;
      }

      this.logger.trace(fileOperation(uri, 'diagnostics'));
      const diagnostics: Diagnostic[] = [];

      const importers = this.filesImporting(uri);

      const cssInfo = this.cssInformation(uri);
      if (cssInfo) {
        const classes = new Set(cssInfo.classNames);

        const removeUsedClasses = async (
          importers: ReadonlyUriSet,
          uris: Uri | Iterable<Uri> = uri,
        ): Promise<void> => {
          for (const importer of importers) {
            if (isCode(importer)) {
              const codeInfo = this.codeInformation(importer);
              if (codeInfo) {
                for (const u of toIterable(uris)) {
                  const cssInfo = this.cssInformation(u);
                  if (cssInfo) {
                    const usages = codeInfo.usages.get(u);
                    if (usages) {
                      for (const usage of usages) {
                        const classNames = cssInfo.localClassNames(usage.localName);
                        if (classNames) {
                          for (const className of classNames) {
                            classes.delete(className);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        };

        const diagnose = (message: string): void => {
          const diagnostic = new Diagnostic(
            new Range(0, 0, 0, 0),
            message,
            toDiagnosticSeverity(this.options.unusedClassesDiagnostics),
          );
          diagnostic.source = 'cmtd';
          diagnostics.push(diagnostic);
        };

        const codeImporters = new UriSet(importers.values().filter((importer) => isCode(importer)));
        const cssImporters = new UriSet(importers.values().filter((importer) => isCss(importer)));

        if (codeImporters.size === 0 && cssImporters.size === 0) {
          // A file that is not imported by any other file.
          this.#commands.set(uri, {
            icon: '⏸️',
            title: `Not imported.`,
            arguments: [],
          });

          diagnose(`${uriName(uri)} is not imported.`);
          classes.clear();
        } else {
          const globalImporters = new UriSet(
            cssImporters.flatMap((importer) =>
              this.filesImporting(importer).filter(
                (uri) =>
                  isCode(uri) && (this.codeInformation(uri)?.unboundImports.has(importer) ?? false),
              ),
            ),
            codeImporters.filter(
              (importer) => this.codeInformation(importer)?.unboundImports.has(uri) ?? false,
            ),
          );
          const moduleImporters = new UriSet(
            cssImporters.flatMap((importer) =>
              this.filesImporting(importer).filter(
                (uri) => isCode(uri) && (this.codeInformation(uri)?.usages.has(importer) ?? false),
              ),
            ),
            codeImporters.filter(
              (importer) => this.codeInformation(importer)?.usages.has(uri) ?? false,
            ),
          );

          const importedAsMixins = classes.size === 0;
          const importedAsGlobal = globalImporters.size > 0;
          const importedAsModule = moduleImporters.size > 0;

          if (importedAsGlobal) {
            classes.clear();
          } else if (importedAsModule) {
            await removeUsedClasses(moduleImporters, cssImporters);
          }

          const icon =
            importedAsMixins ? '🧩'
            : importedAsGlobal && importedAsModule ? '🔀'
            : importedAsGlobal ? '🌎'
            : importedAsModule ? '📦'
            : '⏸️';

          this.#commands.set(uri, {
            icon,
            title: `Imported by ${uriName(cssImporters, moduleImporters, globalImporters)}`,
            arguments: [...cssImporters, ...moduleImporters, ...globalImporters],
          });

          if (isCssGlobal(uri)) {
            // A global CSS file that is imported directly into a code file.
            if (!importedAsMixins) {
              if (importedAsGlobal && importedAsModule) {
                diagnose(`${uriName(uri)} is imported both as Global CSS and Module CSS.`);
              } else if (importedAsModule) {
                if (codeImporters.size > 0) {
                  diagnose(`${uriName(uri)} is imported as Module CSS.`);
                }
              } else if (!importedAsGlobal) {
                diagnose(`${uriName(uri)} is not imported.`);
              }
            }
          }

          if (isCssModule(uri)) {
            // A module CSS file that is imported directly into a code file.
            if (!importedAsMixins) {
              if (importedAsGlobal && importedAsModule) {
                diagnose(`${uriName(uri)} is imported both as Global CSS and Module CSS.`);
              } else if (importedAsGlobal) {
                diagnose(`${uriName(uri)} is imported as Global CSS.`);
              } else if (!importedAsModule) {
                diagnose(`${uriName(uri)} is not imported.`);
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
                continue;
                // if (!this.options.unusedImportedClassesDiagnostics) {
                //   continue;
                // }

                // range = new Range(0, 0, 0, 0);
                // message = `Class "${className}" imported from "${location.source}" is not used.`;
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

      if (diagnostics.length > 0) {
        this.diagnostics.set(uri, diagnostics);
      } else {
        this.diagnostics.delete(uri);
      }
    }
  }
  protected async updateInformation(uri: Uri, override = false): Promise<void> {
    if (isCss(uri)) {
      const oldCssInformation = this.#cssInformation.get(uri);
      const newCssInformation = await (isCssModule(uri) ?
        CssModuleInformation.create({
          uri,
          logger: this.logger,
          options: this.options,
          root: this.folder.uri,
        })
      : CssGlobalInformation.create({
          uri,
          logger: this.logger,
          options: this.options,
        }));

      if (newCssInformation) {
        if (!deepEquals(newCssInformation, oldCssInformation)) {
          this.logger.trace(fileOperation(uri, 'examined'));

          this.#cssInformation.set(uri, newCssInformation);

          if (
            isCssModule(uri) &&
            (override || newCssInformation.hasDts || this.options.css.generateDts)
          ) {
            await newCssInformation.writeTypeDefinition(this.logger);
          }
        }
      } else {
        this.#cssInformation.delete(uri);
      }
    }
  }

  protected async refreshInformation(uri: Uri): Promise<void> {
    if (isCss(uri)) {
      if (!this.#cssInformation.has(uri)) {
        return this.updateInformation(uri);
      }
    }
  }

  protected deleteInformation(uri: Uri): void {
    this.#cssInformation.delete(uri);
  }

  //#region Event Handlers
  protected async handleEditTab(uri: Uri): Promise<void> {
    if (isCss(uri)) {
      this.logger.debug(fileOperation(uri, 'edited'));
      const affectedUris = new UriSet();

      const affected = (): void => {
        for (const importer of this.filesImporting(uri)) {
          affectedUris.add(importer);
          affectedUris.addAll(this.filesImporting(importer));
        }

        const imports = this.cssInformation(uri)?.importedFiles;
        if (imports) {
          affectedUris.addAll(imports);
        }
      };

      affected(); // get all files before the change
      await this.updateInformation(uri);
      affected(); // get all files after the change

      for (const affectedUri of affectedUris) {
        await this.updateInformation(affectedUri);
      }

      await this.updateDiagnostics(uri);
      for (const affectedUri of affectedUris) {
        await this.updateDiagnostics(affectedUri);
      }
    }
  }

  protected async handleIgnored(): Promise<void> {
    for (const css of Array.from(this.#cssInformation.keys())) {
      if (this.isIgnored(css)) {
        this.#cssInformation.delete(css);
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

    for (const css of Array.from(this.#cssInformation.keys())) {
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
    //#region CSS
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
    //#endregion CSS Module
    //#region CSS
    if (isCss(uri)) {
      if (this.openTabs.has(uri) && !this.passTabs.has(uri)) {
        return;
      }
      this.passTabs.delete(uri);

      this.logger.debug(fileOperation(uri, action));
      for (const [file, { importedFiles }] of this.#cssInformation) {
        if (importedFiles.has(uri)) {
          await this.updateDiagnostics(file);
        }
      }
    }
    //#endregion CSS
    //#region DTS
    const cssFile = correspondingSource(uri);
    if (cssFile) {
      this.logger.debug(fileOperation(uri, action));
      const oldCssInformation = this.#cssInformation.get(cssFile);
      if (oldCssInformation) {
        if (action === 'add' || action === 'unlink') {
          const hasDts = action === 'add';

          if (oldCssInformation.hasDts !== hasDts) {
            const newCssInformation = await CssModuleInformation.create({
              uri,
              logger: this.logger,
              options: this.options,
              root: this.folder.uri,
            });
            if (newCssInformation) {
              newCssInformation.hasDts = hasDts;
              this.#cssInformation.set(cssFile, newCssInformation);
            }
          }
        }
      }
    }
    //#endregion DTS

    return super.handleWatcher({ action, uri });
  }
  //#endregion Event Handlers

  public command(uri: Uri): CssCommand | undefined {
    return this.#commands.get(uri);
  }

  public cssInformation(uri: Uri): CssInformation | undefined {
    return this.#cssInformation.get(uri);
  }

  public abstract codeInformation(uri: Uri): CodeInformation | undefined;
  public abstract allCodeInformation(): Promise<ReadonlyUriMap<CodeInformation>>;

  public filesImporting(uri: Uri): ReadonlyUriSet {
    return new ReadonlyUriSet(
      this.#cssInformation
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
        const result = this.cssInformation(uri) as CssModuleInformation;
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

function uriName(...uri: (Uri | Iterable<Uri>)[]): string {
  const set = new UriSet(uri.flatMap((u) => toArray(u)));

  return conjoin(set.map((u) => `⟨${Utils.basename(u)}⟩`));
}
