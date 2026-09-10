import path from 'node:path';

import { capitalize, conjoin, deepEquals, empty, noop, toArray } from '@technobuddha/library';
import { type SetOptional } from 'type-fest';
import {
  type Command,
  Diagnostic,
  DiagnosticSeverity,
  type Disposable,
  Range,
  Uri,
  workspace,
} from 'vscode';
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
        diagnostics.push(...cssInfo.diagnostics);
        const exports = new Set(cssInfo.exportNames);

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
                        const exportNames = cssInfo.localExportNames(usage.localName);
                        if (exportNames) {
                          for (const exportName of exportNames) {
                            exports.delete(exportName);
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

        for (const [animation, [location]] of cssInfo.locationsOfAnimation) {
          if (exports.has(animation)) {
            exports.delete(animation);
          } else {
            const diagnostic = new Diagnostic(
              location.range,
              `Animation "${animation}" is not defined.`,
              toDiagnosticSeverity(this.options.unusedClassesDiagnostics),
            );
            diagnostic.source = 'cmtd';
            diagnostics.push(diagnostic);
          }
        }

        // for (const value of cssInfo.usagesOfValue.keys()) {
        //   exports.delete(value);
        // }
        for (const info of cssInfo.informationOfValues.values()) {
          for (const d of info.diagnostics) {
            diagnostics.push(d);
          }

          if (info.usages.length === 0) {
            for (const l of info.location) {
              diagnostics.push(
                new Diagnostic(l.range, `${info.name} is unused.`, DiagnosticSeverity.Warning),
              );
            }
          }

          for (const { type, range } of info.usages) {
            diagnostics.push(
              new Diagnostic(
                range,
                `${capitalize(type)} "${info.name}" will be replaced by "${info.value}".`,
                DiagnosticSeverity.Information,
              ),
            );
          }
        }

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
          exports.clear();
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

          const importedAsMixins = exports.size === 0;
          const importedAsGlobal = globalImporters.size > 0;
          const importedAsModule = moduleImporters.size > 0;

          if (importedAsMixins) {
            icon = '⭐';
          } else if (importedAsGlobal) {
            icon = importedAsModule ? '🔀' : '🔵';
            exports.clear();
          } else if (importedAsModule) {
            icon = '🟪';
            await removeUsedClasses(moduleImporters, new UriSet([uri], cssImporters));
          } else {
            icon = '⏸️';
            exports.clear();
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

        for (const exportName of exports) {
          const exportInfo = cssInfo.exports.get(exportName);
          if (exportInfo) {
            const typeName =
              exportInfo.type === 'class' ? 'Class '
              : exportInfo.type === 'value' ? 'Value '
              : exportInfo.type === 'keyframe' ? 'Keyframe '
              : empty;

            for (const location of exportInfo.location) {
              if (uri.fsPath === location.uri.fsPath) {
                const message = `${typeName}"${exportName}" is not used.`;

                const diagnostic = new Diagnostic(
                  location.range,
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
            this.logger.error(fileOperation(uri, 'error', error), '<== folder-css:529');
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
