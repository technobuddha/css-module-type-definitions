import { deepEquals, noop } from '@technobuddha/library';
import {
  type CancellationToken,
  Diagnostic,
  DiagnosticSeverity,
  type Disposable,
  Position,
  Range,
  type Uri,
  workspace,
  type WorkspaceEdit,
} from 'vscode';
import { Utils } from 'vscode-uri';

import {
  type Action,
  fileOperation,
  isCode,
  isCssModule,
  type LocalOrExport,
} from '../../../common/index.ts';

import { type ReadonlyUriMap, ReadonlyUriSet, UriMap, UriSet } from '../../helpers/index.ts';
import { uriList } from '../../helpers/uri-list.ts';
import { CodeInformation, type CssModuleInformation } from '../../information/index.ts';

import { FolderCss, type FolderCssArguments } from './folder-css.ts';

export type FolderCodeArguments = FolderCssArguments;

export abstract class FolderCode extends FolderCss implements Disposable {
  readonly #codeInformation: UriMap<CodeInformation> = new UriMap();

  protected override async updateDiagnostics(uri: Uri): Promise<void> {
    if (isCode(uri)) {
      this.logger.debug(fileOperation(uri, 'diagnostics'));
      const codeInfo = this.codeInformation(uri);
      if (codeInfo) {
        const errors: Diagnostic[] = [];

        const importers = new UriSet(
          this.#codeInformation
            .entries()
            .filter(([, info]) => info.importedModules.has(uri))
            .map(([uri]) => uri),
        );

        const icon = importers.size > 0 ? '🧩' : '⏸️';
        const title = importers.size > 0 ? `Imported by ${uriList(importers)}.` : 'Not imported.';

        this.commands.set(uri, {
          icon,
          title,
          arguments: [uri, [...importers]],
        });

        for (const importUri of codeInfo.importedCssBound) {
          if (isCssModule(importUri)) {
            const cssInfo = this.cssInformation<CssModuleInformation>(importUri);
            if (cssInfo && !cssInfo.hasDts) {
              const usages = codeInfo.usages.get(importUri);
              if (usages) {
                for (const usage of usages) {
                  if (!cssInfo.exportNamesOfLocalName.has(usage.localName)) {
                    // TODO find the type of the usage.
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
          }
        }

        if (errors.length > 0) {
          this.diagnostics.set(uri, errors);
        } else {
          this.diagnostics.delete(uri);
        }
      }
    } else {
      return super.updateDiagnostics(uri);
    }
  }

  protected override async updateInformation(uri: Uri, override = false): Promise<void> {
    if (isCode(uri)) {
      const oldCodeInformation = this.#codeInformation.get(uri);
      const newCodeInformation = await CodeInformation.create(uri, this.folder.uri).catch(noop);

      if (newCodeInformation) {
        if (!deepEquals(newCodeInformation, oldCodeInformation)) {
          this.logger.trace(fileOperation(uri, 'examined'));

          this.#codeInformation.set(uri, newCodeInformation);
        }
      } else if (oldCodeInformation) {
        this.logger.trace(fileOperation(uri, 'examined'));

        this.#codeInformation.delete(uri);
      }
    } else {
      return super.updateInformation(uri, override);
    }
  }

  protected override async refreshInformation(uri: Uri): Promise<void> {
    if (isCode(uri)) {
      if (!this.#codeInformation.has(uri)) {
        return this.updateInformation(uri);
      }
      return;
    }
    return super.refreshInformation(uri);
  }

  protected override deleteInformation(uri: Uri): void {
    this.#codeInformation.delete(uri);
    super.deleteInformation(uri);
  }
  //#region Event Handlers

  protected override async handleIgnored(): Promise<void> {
    for (const uri of Array.from(this.#codeInformation.keys())) {
      if (this.isIgnored(uri)) {
        this.#codeInformation.delete(uri);
      }
    }

    return super.handleIgnored();
  }

  protected override async handleWatcher({
    action,
    uri,
  }: {
    action: Action;
    uri: Uri;
  }): Promise<void> {
    if (isCode(uri)) {
      if (this.openTabs.has(uri) && !this.passTabs.has(uri)) {
        return;
      }
      this.passTabs.delete(uri);

      this.logger.trace(fileOperation(uri, action));
      await this.updateInformation(uri);
    }

    return super.handleWatcher({ action, uri });
  }
  //#endregion Event Handlers

  protected override async updateAffected(uri: Uri): Promise<void> {
    if (isCode(uri)) {
      const uris = new UriSet();

      const affected = (): void => {
        const codeInfo = this.codeInformation(uri);
        if (codeInfo) {
          for (const importUri of codeInfo.importedCssBound) {
            uris.add(importUri);

            const info = this.cssInformation(importUri);
            if (info) {
              for (const file of info?.importedFiles) {
                uris.add(file);
              }
            }
          }
        }
      };

      affected(); // get all files before the change
      await this.updateInformation(uri);
      affected(); // get all files after the change

      for (const code of uris) {
        await this.updateInformation(code);
      }

      await this.updateDiagnostics(uri);
      for (const code of uris) {
        await this.updateDiagnostics(code);
      }
    } else {
      return super.updateAffected(uri);
    }
  }

  public codeInformation(uri: Uri): CodeInformation | undefined {
    return this.#codeInformation.get(uri);
  }

  public async allCodeInformation(): Promise<ReadonlyUriMap<CodeInformation>> {
    await this.prepare();
    return this.#codeInformation;
  }

  public codeFilesImporting(uri: Uri): ReadonlyUriSet {
    return new ReadonlyUriSet(
      this.#codeInformation
        .entries()
        .filter(([, info]) => info.importedCssBound.has(uri))
        .map(([importer]) => importer),
    );
  }

  public override filesImporting(uri: Uri): UriSet {
    return new UriSet(
      this.#codeInformation
        .entries()
        .filter(([, info]) => info.importedCssBound.has(uri))
        .map(([importer]) => importer),
      super.filesImporting(uri),
    );
  }

  public async edit({
    we,
    importUri,
    codeReplacement,
    cssReplacement,
    exportName,
    localName,
    token,
  }: EditCodeArguments): Promise<void> {
    await this.prepare();

    if (isCssModule(importUri)) {
      const cssInfo = this.cssInformation<CssModuleInformation>(importUri)!;
      if (cssInfo) {
        const locations =
          exportName ? cssInfo.cssLocations({ exportName })
          : localName ? cssInfo.cssLocations({ localName })
          : undefined;
        if (locations) {
          for (const location of locations) {
            this.logger.debug(
              '>>>',
              Utils.basename(location.uri),
              ' > ',
              `${location.range.start.line}:${location.range.start.character} - ${location.range.end.line}:${location.range.end.character}`,
            );
            this.passTabs.add(location.uri);
            we.replace(location.uri, location.range, cssReplacement);
          }
        }

        const locals =
          exportName ? cssInfo.localNames({ exportName })
          : localName ? cssInfo.localNames({ localName })
          : new Set();

        for (const codeInfo of this.#codeInformation.values()) {
          if (token?.isCancellationRequested) {
            return;
          }

          const usages = codeInfo.usages
            .get(importUri)
            ?.filter((usage) => locals.has(usage.localName));
          if (usages) {
            for (const usage of usages) {
              const { range } = usage;
              const document = await workspace.openTextDocument(codeInfo.file);

              if (range.start.character >= 2) {
                const expandedRange = new Range(
                  new Position(range.start.line, range.start.character - 1),
                  new Position(range.end.line, range.end.character + 1),
                );

                if (/^\[(?:(?:'.*')|(?:".*"))\]$/v.test(document.getText(expandedRange))) {
                  this.passTabs.add(document.uri);
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
                  this.passTabs.add(document.uri);
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

type EditCodeArguments = LocalOrExport & {
  we: WorkspaceEdit;
  importUri: Uri;
  codeReplacement: string;
  cssReplacement: string;
  token?: CancellationToken;
};
