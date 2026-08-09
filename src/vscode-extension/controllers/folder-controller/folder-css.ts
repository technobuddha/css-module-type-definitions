import path from 'node:path';

import { noop, toError } from '@technobuddha/library';
import { Diagnostic, DiagnosticSeverity, type Disposable, Range, Uri, workspace } from 'vscode';
import { Utils } from 'vscode-uri';

import {
  type Action,
  correspondingSource,
  fileOperation,
  globIsCssModule,
  globIsCssTypeDefinition,
  isCss,
  isCssModule,
} from '../../../common/index.ts';
import { generateTypesFromCss } from '../../../css-library/index.ts';

import { type CodeInformation } from '../../code-information/index.ts';
import { CssInformation } from '../../css-information/index.ts';
import { type ReadonlyUriMap, UriMap } from '../../helpers/index.ts';

import { cssImporter } from './css-importer/index.ts';
import { FolderOptions, type FolderOptionsArguments } from './folder-options.ts';

export type FolderCssArguments = FolderOptionsArguments;

export abstract class FolderCss extends FolderOptions implements Disposable {
  protected readonly cssInformation: UriMap<CssInformation> = new UriMap();

  public constructor({ workspaceController, folder }: FolderCssArguments) {
    super({ workspaceController, folder });
  }

  protected async ignored(): Promise<void> {
    for (const cssFile of Array.from(this.cssInformation.keys())) {
      if (this.isIgnored(cssFile)) {
        this.cssInformation.delete(cssFile);
        await this.onCssInformationChanged(cssFile);
      }
    }
  }

  protected async watched(action: Action, uri: Uri): Promise<void> {
    if (isCssModule(uri)) {
      this.logger.debug(fileOperation(uri.fsPath, action));
      return action === 'unlink' ? this.onCssModuleDeleted(uri) : this.onCssModuleChanged(uri);
    }

    if (isCss(uri)) {
      this.logger.debug(fileOperation(uri.fsPath, action));
      return this.onCssChanged(uri);
    }

    const dtsFile = correspondingSource(uri);
    if (dtsFile) {
      return this.onDtsChanged(dtsFile, action);
    }
  }

  protected async onCssModuleChanged(uri: Uri): Promise<void> {
    return this.cssInformationForFile(uri, false).then(async (cssInfo) => {
      if (cssInfo && this.options.css.generateDts) {
        return cssInfo.writeTypeDefinitionFiles(this.logger);
      }
    });
  }

  protected async onCssModuleDeleted(uri: Uri): Promise<void> {
    return this.deleteCss(uri);
  }

  protected async onCssChanged(uri: Uri): Promise<void> {
    for (const [file, { includedFiles }] of this.cssInformation) {
      if (includedFiles.has(uri.fsPath)) {
        await this.updateDiagnosticsForCssModule(file).then(async (cssInfo) => {
          if (cssInfo && this.options.css.generateDts) {
            return cssInfo.writeTypeDefinitionFiles(this.logger);
          }
        });
      }
    }
  }

  protected async onDtsChanged(uri: Uri, action: Action): Promise<void> {
    const cssInfo = this.cssInformation.get(uri);
    if (cssInfo) {
      if (action === 'add' || action === 'unlink') {
        this.logger.debug(fileOperation(uri.fsPath, action));
        cssInfo.hasDts = action === 'add';
        await this.onCssInformationChanged(uri);
      }
    }
  }

  public override async init(): Promise<void> {
    await super.init();

    this.eventTarget.addEventListener('options', async () => {
      await this.updateCssTypeDefinitions();
    });

    this.eventTarget.addEventListener('ignored', async () => this.ignored());
    this.eventTarget.addEventListener('watcher', async ({ detail: { action, uri } }) =>
      this.watched(action, uri),
    );
  }

  public async updateDiagnosticsForTab(uri: Uri): Promise<void> {
    if (isCssModule(uri)) {
      return this.updateDiagnosticsForCssModule(uri).then(noop);
    }

    if (isCss(uri)) {
      await this.onCssChanged(uri);
    }
  }

  public async updateDiagnosticsForCssModule(uri: Uri): Promise<CssInformation | undefined> {
    const cssInfo = await this.cssInformationForFile(uri, false);
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
                range = new Range(0, 0, 0, 0);
                message = `Class "${className}" imported from "${location.source}" is not used.`;
              }

              const diagnostic = new Diagnostic(range, message, DiagnosticSeverity.Warning);
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
      }
    }
    return cssInfo;
  }

  protected abstract codeInformationForCssModule(uri: Uri): Promise<CodeInformation[]>;

  protected async deleteCss(uri: Uri): Promise<void> {
    const { dir, name, ext } = path.parse(uri.fsPath);

    this.cssInformation.delete(uri);
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

  public async cssInformationForFile(
    uri: Uri,
    useCache = true,
  ): Promise<CssInformation | undefined> {
    if (useCache && this.cssInformation.has(uri)) {
      return this.cssInformation.get(uri)!;
    }

    const { logger, options } = this;

    if (isCssModule(uri) && !this.isIgnored(uri)) {
      try {
        const cssInfo = await workspace
          .openTextDocument(uri)
          .then(async (document) =>
            generateTypesFromCss(document.getText(), uri.fsPath, {
              options,
              logger,
              cssImporter: cssImporter({ root: Utils.dirname(uri), logger }),
            }),
          )
          .then((cssInfo) => new CssInformation(cssInfo));

        if (cssInfo) {
          this.cssInformation.set(uri, cssInfo);
          await this.onCssInformationChanged(uri);
          return cssInfo;
        }

        this.cssInformation.delete(uri);
        await this.onCssInformationChanged(uri);
        return undefined;
      } catch (e) {
        logger.error(toError(e));
      }
    }
    return undefined;
  }

  public cssInformationForImportedFile(uri: Uri): CssInformation[] | undefined {
    const result: CssInformation[] = [];
    for (const cssInfo of this.cssInformation.values()) {
      if (cssInfo.includedFiles.has(uri.fsPath)) {
        result.push(cssInfo);
      }
    }
    return result.length > 0 ? result : undefined;
  }

  public async updateCssTypeDefinitions(): Promise<void> {
    const { logger, options } = this;

    this.cssInformation.clear();

    const typedefs = new Set(
      (await this.findUnignoredFiles(`**/${globIsCssTypeDefinition()}`)).map((uri) => uri.fsPath),
    );

    await this.findUnignoredFiles(`**/${globIsCssModule()}`).then(async (uris) => {
      for (const uri of uris) {
        const result = await this.cssInformationForFile(uri);
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

  public async getAllCssInformation(): Promise<ReadonlyUriMap<CssInformation>> {
    await this.findUnignoredFiles(`**/${globIsCssModule()}`).then(async (uris) => {
      for (const uri of uris) {
        await this.cssInformationForFile(uri);
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
            .map(([importer]) => importer)
            .toArray(),
        );
  }
}
