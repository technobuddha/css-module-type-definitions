import path from 'node:path';

import { conjoin, deepEquals, empty, noop, toArray } from '@technobuddha/library';
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

      this.logger.debug(fileOperation(uri, 'diagnostics'));
      const diagnostics: Diagnostic[] = [];

      const importers = this.filesImporting(uri);

      const cssInfo = this.cssInformation(uri);
      if (cssInfo) {
        const classes = new Set(cssInfo.classNames);

        const removeUsedClasses = async (
          importers: ReadonlyUriSet,
          uris: ReadonlyUriSet,
        ): Promise<void> => {
          for (const importer of importers) {
            if (isCode(importer)) {
              const codeInfo = this.codeInformation(importer);
              if (codeInfo) {
                for (const u of uris) {
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

        let icon = empty;
        let title = empty;
        let tooltip = empty;
        let args: Uri[] = [];

        if (codeImporters.size === 0 && cssImporters.size === 0) {
          icon = '⏸️';
          title = `Not imported.`;
          tooltip = `This ${isCssModule(uri) ? 'Module' : 'Global'} CSS file is not imported.`;

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

          if (importedAsMixins) {
            icon = '⭐';
          } else if (importedAsGlobal) {
            icon = importedAsModule ? '🔀' : '🔵';
            classes.clear();
          } else if (importedAsModule) {
            icon = '🟪';
            await removeUsedClasses(moduleImporters, new UriSet([uri], cssImporters));
          } else {
            icon = '⏸️';
            classes.clear();
          }

          title = `Imported by ${uriName(cssImporters, moduleImporters, globalImporters)}`;
          args = [...cssImporters, ...moduleImporters, ...globalImporters];

          if (isCssGlobal(uri)) {
            if (importedAsMixins) {
              tooltip = 'This CSS file has no class definitions.';
            } else if (importedAsGlobal) {
              if (importedAsModule) {
                tooltip = 'This CSS file is imported both as Global and Module CSS.';
                diagnose(`Imported both as Global CSS and Module CSS.`);
              } else {
                tooltip = 'This CSS file is imported as Global CSS.';
              }
            }
            if (importedAsModule) {
              tooltip = 'This CSS file is imported as Module CSS.';
            } else {
              tooltip = 'This CSS file is not imported into any code file.';
              diagnose(`CSS file is not imported into any code file.`);
            }
          }

          if (isCssModule(uri)) {
            if (importedAsMixins) {
              tooltip = 'This Module CSS file has no class definitions.';
            } else if (importedAsGlobal) {
              if (importedAsModule) {
                tooltip = 'This Module CSS file is imported both as Module and Global CSS.';
                diagnose(`Imported both as Module CSS and Global CSS.`);
              } else {
                tooltip = 'This Module CSS file is imported as Global CSS.';
                diagnose('Module CSS file is imported as Global CSS');
              }
            } else if (importedAsModule) {
              tooltip = 'This Module CSS file is imported as Module CSS.';
            } else {
              tooltip = 'This Module CSS file is not imported into any code file.';
              diagnose(`Module CSS file is not imported into any code file.`);
            }
          }
        }

        this.#commands.set(uri, {
          icon,
          title,
          tooltip,
          arguments: [uri, args],
        });

        for (const className of classes) {
          const locations = cssInfo.locationsOfClassName.get(className);
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
        const isEqual = deepEquals(newCssInformation, oldCssInformation);

        if (!isEqual) {
          this.logger.trace(fileOperation(uri, 'examined'));

          this.#cssInformation.set(uri, newCssInformation);
        }
        if (
          isCssModule(uri) &&
          (override || (!isEqual && (newCssInformation.hasDts || this.options.css.generateDts)))
        ) {
          await newCssInformation.writeTypeDefinition(this.logger);
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

      this.logger.trace(fileOperation(uri, action));
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
              this.logger.trace(fileOperation(generatedUri, 'deleted'));
            }, noop);
          }
        }
      } else {
        await this.updateAffected(uri);
      }
    }
    //#endregion CSS Module
    //#region CSS
    if (isCss(uri)) {
      if (this.openTabs.has(uri) && !this.passTabs.has(uri)) {
        return;
      }
      this.passTabs.delete(uri);

      this.logger.trace(fileOperation(uri, action));
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
      this.logger.trace(fileOperation(uri, action));
      const oldCssInformation = this.#cssInformation.get(cssFile);
      if (oldCssInformation) {
        if (action === 'add' || action === 'unlink') {
          const hasDts = action === 'add';

          if (oldCssInformation.hasDts !== hasDts) {
            const newCssInformation = await CssModuleInformation.create({
              uri: cssFile,
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

  protected async updateAffected(uri: Uri): Promise<void> {
    if (isCss(uri)) {
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

  public command(uri: Uri): CssCommand | undefined {
    return this.#commands.get(uri);
  }

  public cssInformation<T extends CssInformation = CssInformation>(uri: Uri): T | undefined {
    return this.#cssInformation.get(uri) as T | undefined;
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
        const result = this.cssInformation<CssModuleInformation>(uri);
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
