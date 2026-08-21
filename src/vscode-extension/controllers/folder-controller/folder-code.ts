import { deepDifference, deepEquals, empty, noop } from '@technobuddha/library';
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
  globIsCode,
  isCode,
  isCssModule,
} from '../../../common/index.ts';

import { type ReadonlyUriMap, ReadonlyUriSet, UriMap, UriSet } from '../../helpers/index.ts';
import { CodeInformation } from '../../information/index.ts';

import { FolderCss, type FolderCssArguments } from './folder-css.ts';

export type FolderCodeArguments = FolderCssArguments;

export abstract class FolderCode extends FolderCss implements Disposable {
  readonly #codeInformation: UriMap<CodeInformation> = new UriMap();
  readonly #updatingCodeInformation = new UriSet();

  protected override async updateDiagnostics(uri: Uri): Promise<void> {
    if (isCode(uri)) {
      this.logger.debug('>', fileOperation(uri, 'diagnostics'));
      const codeInfo = await this.codeInformation(uri);
      if (codeInfo) {
        const errors: Diagnostic[] = [];

        for (const importUri of codeInfo.cssImports) {
          if (isCssModule(importUri)) {
            const cssInfo = await this.cssInformation(importUri);
            if (cssInfo && !cssInfo.hasDts) {
              const usages = codeInfo.usages.get(importUri);
              if (usages) {
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
          }
        }

        if (errors.length > 0) {
          this.diagnostics.set(uri, errors);
        } else {
          this.diagnostics.delete(uri);
        }
        this.logger.debug('<', fileOperation(uri, 'diagnostics'));
      }
    } else {
      return super.updateDiagnostics(uri);
    }
  }

  protected override async updateInformation(uri: Uri, override = false): Promise<void> {
    if (isCode(uri)) {
      const oldCodeInformation = this.#codeInformation.get(uri);
      const newCodeInformation = await CodeInformation.create(uri, this.logger).catch(noop);

      if (newCodeInformation) {
        if (!deepEquals(newCodeInformation, oldCodeInformation)) {
          this.logger.trace(
            fileOperation(uri, 'examined'),
            ' != ',
            deepDifference(oldCodeInformation, newCodeInformation) ?? empty,
          );

          this.#codeInformation.set(uri, newCodeInformation);
        }
      } else if (oldCodeInformation) {
        this.logger.trace(fileOperation(uri, 'examined'), ' == ');

        this.#codeInformation.delete(uri);
      }
    } else {
      return super.updateInformation(uri, override);
    }
  }

  protected override deleteInformation(uri: Uri): void {
    this.#codeInformation.delete(uri);
    super.deleteInformation(uri);
  }

  public override async init(): Promise<void> {
    await super.init();

    this.on('cssInformationChanged', async ({ uri }) => {
      for (const tab of this.openTabs) {
        if (isCode(tab)) {
          await this.codeInformation(tab).then(async (codeInfo) => {
            if (codeInfo?.cssImports.has(uri)) {
              return this.updateDiagnostics(tab);
            }
          });
        }
      }
    }).on('codeInformationChanged', async ({ uri }) => {
      if (this.openTabs.has(uri)) {
        await this.updateDiagnostics(uri);
      }
    });
  }

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

      this.logger.debug(fileOperation(uri, action));
      await this.updateCodeInformation(uri);
    }

    return super.handleWatcher({ action, uri });
  }

  public async codeInformation(uri: Uri): Promise<CodeInformation | undefined> {
    return this.#codeInformation.get(uri) ?? (await this.updateCodeInformation(uri));
  }

  public async updateCodeInformation(uri: Uri): Promise<CodeInformation | undefined> {
    if (this.#updatingCodeInformation.has(uri)) {
      return this.#codeInformation.get(uri);
    }
    this.#updatingCodeInformation.add(uri);

    const { logger } = this;
    const oldCodeInformation = this.#codeInformation.get(uri);

    const newCodeInformation =
      isCode(uri) && !this.isIgnored(uri) ? await CodeInformation.create(uri, logger) : undefined;

    if (newCodeInformation) {
      if (!deepEquals(newCodeInformation, oldCodeInformation)) {
        logger.trace(
          fileOperation(uri, 'examined'),
          ` => ${deepDifference(oldCodeInformation, newCodeInformation)}`,
        );
        this.#codeInformation.set(uri, newCodeInformation);
        await this.fire('codeInformationChanged', { uri, oldCodeInformation, newCodeInformation });
      }
    } else {
      this.#codeInformation.delete(uri);
      if (oldCodeInformation) {
        await this.fire('codeInformationChanged', { uri, oldCodeInformation, newCodeInformation });
      }
    }

    this.#updatingCodeInformation.delete(uri);
    return newCodeInformation;
  }

  public async allCodeInformation(): Promise<ReadonlyUriMap<CodeInformation>> {
    await this.findUnignoredFiles(`**/${globIsCode()}`).then(async (uris) => {
      for (const uri of uris) {
        if (isCode(uri)) {
          await this.updateCodeInformation(uri);
        }
      }
    });
    return this.#codeInformation;
  }

  public codeFilesImporting(uri: Uri): ReadonlyUriSet {
    return new ReadonlyUriSet(
      this.#codeInformation
        .entries()
        .filter(([, info]) => info.cssImports.has(uri))
        .map(([importer]) => importer),
    );
  }

  public override filesImporting(uri: Uri): ReadonlyUriSet {
    return new ReadonlyUriSet(
      this.#codeInformation
        .entries()
        .filter(([, info]) => info.cssImports.has(uri))
        .map(([importer]) => importer),
      super.filesImporting(uri),
    );
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
    const cssInfo = await this.cssInformation(importUri);
    if (cssInfo) {
      const locations = cssInfo.cssLocations({ className, localName, importUri });
      if (locations) {
        for (const location of locations) {
          this.passTabs.add(location.uri);
          we.replace(location.uri, location.range, cssReplacement);
        }
      }

      const locals = cssInfo.localNames({ className, localName });

      for (const codeInfo of (await this.allCodeInformation()).values()) {
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

type LocalOrClass =
  { localName: string; className?: undefined } | { localName?: undefined; className: string };

type EditCodeArguments = LocalOrClass & {
  we: WorkspaceEdit;
  importUri: Uri;
  codeReplacement: string;
  cssReplacement: string;
  token?: CancellationToken;
};
