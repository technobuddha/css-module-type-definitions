import {
  type CancellationToken,
  Diagnostic,
  DiagnosticSeverity,
  type Disposable,
  Position,
  Range,
  Uri,
  workspace,
  type WorkspaceEdit,
} from 'vscode';
import { Utils } from 'vscode-uri';

import { fileOperation, globIsCode, isCode, isCssModule } from '../../../common/index.ts';

import { scanImports } from '../../helpers/index.ts';

import { FolderCss, type FolderCssArguments } from './folder-css.ts';

export type FolderCodeArguments = FolderCssArguments;

export abstract class FolderCode extends FolderCss implements Disposable {
  protected readonly openTabs: Set<string> = new Set();
  protected readonly cssModuleImports: Map<string, Uri[]> = new Map();
  protected cssImporters: Map<string, Set<string>> | undefined = undefined;

  public constructor({ workspaceController, folder }: FolderCodeArguments) {
    super({ workspaceController, folder });

    this.eventTarget.addEventListener('watcher', async ({ detail: { action, uri } }) => {
      if (isCode(uri)) {
        this.logger.debug(fileOperation(uri.fsPath, action));

        if (action === 'unlink') {
          await this.deleteCssModuleImports(uri);
        } else {
          await this.getCssModuleImports(uri, false);
        }
      }
    });

    this.eventTarget.addEventListener('ignored', () => {
      this.deleteIgnoredImports();
    });
  }

  protected override async onCssInformationChanged(uri: Uri): Promise<void> {
    for (const file of this.getCssImporters(uri)) {
      if (this.openTabs.has(file)) {
        await this.updateTab(Uri.file(file));
      }
    }
  }

  protected getCssImporters(uri: Uri): Set<string> {
    if (this.cssImporters) {
      return this.cssImporters.get(uri.fsPath) ?? new Set();
    }

    this.cssImporters = new Map();
    for (const [file, imports] of this.cssModuleImports) {
      for (const importUri of imports) {
        const key = importUri.fsPath;
        this.cssImporters.getOrInsertComputed(key, () => new Set()).add(file);
      }
    }
    return this.cssImporters.get(uri.fsPath) ?? new Set();
  }

  public async getCssModuleImports(uri: Uri, cache = true): Promise<Uri[] | undefined> {
    if (cache && this.cssModuleImports.has(uri.fsPath)) {
      return this.cssModuleImports.get(uri.fsPath)!;
    }

    if (isCode(uri) && !this.isIgnored(uri)) {
      const result = await scanImports(uri)
        .then((uris) => uris.filter((u) => isCssModule(u)))
        .catch(() => []);
      this.cssModuleImports.set(uri.fsPath, result);
      this.cssImporters = undefined;
      return result;
    }
    return undefined;
  }

  public async allCssModuleImports(): Promise<ReadonlyMap<string, Uri[]>> {
    await this.findUnignoredFiles(`**/${globIsCode()}`).then(async (uris) => {
      for (const uri of uris) {
        if (isCode(uri)) {
          await this.getCssModuleImports(uri, false);
        }
      }
    });
    return this.cssModuleImports;
  }

  public async deleteCssModuleImports(uri: Uri): Promise<void> {
    this.cssModuleImports.delete(uri.fsPath);
  }

  public deleteIgnoredImports(): void {
    for (const file of Array.from(this.cssModuleImports.keys())) {
      if (this.isIgnored(Uri.file(file))) {
        this.cssModuleImports.delete(file);
      }
    }
  }

  public async updateTab(uri: Uri): Promise<void> {
    const importUris = await this.getCssModuleImports(uri);
    if (importUris) {
      const errors: Diagnostic[] = [];

      for (const importUri of importUris) {
        const cssInfo = await this.getCssInformation(importUri);
        if (cssInfo && !cssInfo.hasDts) {
          const document = await workspace.openTextDocument(uri);
          const usages = await cssInfo.usages({ document, importUri });
          for (const usage of usages) {
            if (!cssInfo.localClass.has(usage.localName)) {
              const error = new Diagnostic(
                usage.range,
                `Class "${usage.localName}" is not defined in "${Utils.basename(importUri)}"`,
                DiagnosticSeverity.Error,
              );
              error.source = 'cmtd';

              errors.push(error);
            }
          }
        }
      }

      if (errors.length > 0) {
        this.diagnostics.set(uri, errors);
      } else {
        this.diagnostics.delete(uri);
      }
    }
  }

  public async onOpenTab(uri: Uri): Promise<void> {
    this.openTabs.add(uri.fsPath);
    void this.updateTab(uri);
  }

  public async onCloseTab(uri: Uri): Promise<void> {
    this.diagnostics.delete(uri);
    this.openTabs.delete(uri.fsPath);
  }

  public async edit({
    we,
    importUri,
    codeReplacement,
    cssReplacement,
    className,
    localName,
    token,
  }: EditCodeArguments): Promise<void> {
    const cssInfo = await this.getCssInformation(importUri);
    if (cssInfo) {
      const locations = cssInfo.cssLocations({ className, localName, importUri });
      if (locations) {
        for (const location of locations) {
          we.replace(location.uri, location.range, `.${cssReplacement}`);
        }
      }

      for (const [file, imports] of await this.allCssModuleImports()) {
        if (token?.isCancellationRequested) {
          return;
        }

        if (imports.some((i) => i.fsPath === importUri.fsPath)) {
          const classUsages = await cssInfo.classUsage({
            className,
            localName,
            file,
            importUri,
          });
          if (classUsages) {
            const { document, usages } = classUsages;

            for (const usage of usages) {
              const { range } = usage;

              if (range.start.character >= 2) {
                const expandedRange = new Range(
                  new Position(range.start.line, range.start.character - 1),
                  new Position(range.end.line, range.end.character + 1),
                );

                if (/^\[(?:(?:'.*')|(?:".*"))\]$/v.test(document.getText(expandedRange))) {
                  we.replace(document.uri, expandedRange, codeReplacement);
                  continue;
                }
              }

              if (range.start.character >= 1) {
                const expandedRange = new Range(
                  new Position(range.start.line, range.start.character - 1),
                  new Position(range.end.line, range.end.character),
                );

                if (/^\..*$/v.test(document.getText(expandedRange))) {
                  we.replace(document.uri, expandedRange, codeReplacement);
                }
              }
            }
          }
        }
      }
    }
  }
}

type LocalOrClass =
  { localName: string; className?: undefined } | { localName?: undefined; className: string };

type EditCodeArguments = LocalOrClass & {
  we: WorkspaceEdit;
  importUri: Uri;
  codeReplacement: string;
  cssReplacement: string;
  token?: CancellationToken;
};
