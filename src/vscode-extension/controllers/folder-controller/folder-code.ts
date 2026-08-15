import {
  type CancellationToken,
  Diagnostic,
  DiagnosticSeverity,
  type Disposable,
  Position,
  Range,
  type Uri,
  type WorkspaceEdit,
} from 'vscode';
import { Utils } from 'vscode-uri';

import { fileOperation, globIsCode, isCode } from '../../../common/index.ts';

import { CodeInformation } from '../../code-information/index.ts';
import { type ReadonlyUriMap, UriMap } from '../../helpers/index.ts';

import { FolderCss, type FolderCssArguments } from './folder-css.ts';

export type FolderCodeArguments = FolderCssArguments;

export abstract class FolderCode extends FolderCss implements Disposable {
  private readonly codeInformation: UriMap<CodeInformation> = new UriMap();

  public constructor({ workspaceController, folder }: FolderCodeArguments) {
    super({ workspaceController, folder });
  }

  private async updateDiagnosticsForCode(uri: Uri): Promise<void> {
    const codeInfo = this.getCodeInformation(uri);
    if (codeInfo) {
      const errors: Diagnostic[] = [];

      for (const importUri of codeInfo.cssModuleImports) {
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

      if (errors.length > 0) {
        this.diagnostics.set(uri, errors);
      } else {
        this.diagnostics.delete(uri);
      }
    }
  }

  protected async updateCodeInformation(uri: Uri): Promise<void> {
    const { logger } = this;
    const oldCodeInformation = this.codeInformation.get(uri);

    const newCodeInformation =
      isCode(uri) && !this.isIgnored(uri) ? await CodeInformation.create(uri) : undefined;

    if (newCodeInformation) {
      if (!newCodeInformation.equals(oldCodeInformation)) {
        logger.trace(fileOperation(uri.fsPath, 'examined'));
        this.codeInformation.set(uri, newCodeInformation);
        await this.fire('codeInformationChanged', { uri, oldCodeInformation, newCodeInformation });
      }
    } else {
      this.codeInformation.delete(uri);
      if (oldCodeInformation) {
        await this.fire('codeInformationChanged', { uri, oldCodeInformation, newCodeInformation });
      }
    }
  }

  protected getCodeInformation(uri: Uri): CodeInformation | undefined {
    return this.codeInformation.get(uri);
  }

  public override async init(): Promise<void> {
    await super.init();

    this.on('ignored', () => {
      for (const uri of Array.from(this.codeInformation.keys())) {
        if (this.isIgnored(uri)) {
          this.codeInformation.delete(uri);
        }
      }
    })
      .on('watcher', async ({ action, uri }) => {
        if (isCode(uri)) {
          if (this.openTabs.has(uri) && !this.passTabs.has(uri)) {
            this.logger.trace(fileOperation(uri.fsPath, `omit-${action}`));
            return;
          }
          this.passTabs.delete(uri);

          this.logger.debug(fileOperation(`${uri.fsPath} => code`, action));
          await this.updateCodeInformation(uri);
        }
      })
      .on('openTab', async (uri) => {
        if (isCode(uri)) {
          this.logger.debug(fileOperation(uri.fsPath, 'opened'));
          await this.updateCodeInformation(uri);
        }
      })
      .on('editTab', async (uri) => {
        if (isCode(uri)) {
          this.logger.debug(fileOperation(uri.fsPath, 'edited'));
          await this.updateCodeInformation(uri);
        }
      })
      .on('closeTab', async (uri) => {
        if (isCode(uri)) {
          this.logger.debug(fileOperation(uri.fsPath, 'closed'));
          this.diagnostics.delete(uri);
          await this.updateCodeInformation(uri);
        }
      })
      .on('cssInformationChanged', async ({ uri }) => {
        for (const tab of this.openTabs) {
          if (isCode(tab)) {
            const codeInfo = this.getCodeInformation(tab);
            if (codeInfo?.cssModuleImports.some((i) => i.fsPath === uri.fsPath)) {
              await this.updateDiagnosticsForCode(tab);
            }
          }
        }
      })
      .on('codeInformationChanged', async ({ uri }) => {
        if (this.openTabs.has(uri)) {
          await this.updateDiagnosticsForCode(uri);
        }
      });
  }

  public async codeInformationForCssModule(uri: Uri): Promise<CodeInformation[]> {
    const codeInfos: CodeInformation[] = [];

    for (const codeInfo of (await this.allCodeInformation()).values()) {
      if (codeInfo.cssModuleImports.some((i) => i.fsPath === uri.fsPath)) {
        codeInfos.push(codeInfo);
      }
    }
    return codeInfos;
  }

  public async allCodeInformation(): Promise<ReadonlyUriMap<CodeInformation>> {
    await this.findUnignoredFiles(`**/${globIsCode()}`).then(async (uris) => {
      for (const uri of uris) {
        if (isCode(uri)) {
          await this.updateCodeInformation(uri);
        }
      }
    });
    return this.codeInformation;
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

            if (range.start.character >= 2) {
              const expandedRange = new Range(
                new Position(range.start.line, range.start.character - 1),
                new Position(range.end.line, range.end.character + 1),
              );

              if (/^\[(?:(?:'.*')|(?:".*"))\]$/v.test(codeInfo.document.getText(expandedRange))) {
                this.passTabs.add(codeInfo.document.uri);
                we.replace(codeInfo.document.uri, expandedRange, codeReplacement);
                continue;
              }
            }

            if (range.start.character >= 1) {
              const expandedRange = new Range(
                new Position(range.start.line, range.start.character - 1),
                new Position(range.end.line, range.end.character),
              );

              if (/^\..*$/v.test(codeInfo.document.getText(expandedRange))) {
                this.passTabs.add(codeInfo.document.uri);
                we.replace(codeInfo.document.uri, expandedRange, codeReplacement);
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
