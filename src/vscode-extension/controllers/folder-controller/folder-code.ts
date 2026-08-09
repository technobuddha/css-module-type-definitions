import { toError } from '@technobuddha/library';
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

import { fileOperation, globIsCode, isCode, operation } from '../../../common/index.ts';

import { CodeInformation } from '../../code-information/index.ts';
import { type ReadonlyUriMap, UriMap } from '../../helpers/index.ts';

import { FolderCss, type FolderCssArguments } from './folder-css.ts';

export type FolderCodeArguments = FolderCssArguments;

export abstract class FolderCode extends FolderCss implements Disposable {
  protected readonly codeInformation: UriMap<CodeInformation> = new UriMap();

  public constructor({ workspaceController, folder }: FolderCodeArguments) {
    super({ workspaceController, folder });
  }

  public override async init(): Promise<void> {
    await super.init();

    this.eventTarget.addEventListener('watcher', async ({ detail: { action, uri } }) => {
      if (isCode(uri)) {
        this.logger.debug(fileOperation(uri.fsPath, action));

        if (action === 'unlink') {
          await this.deleteCodeInformation(uri);
        } else {
          await this.getCodeInformation(uri, false);
        }
      }
    });

    this.eventTarget.addEventListener('ignored', () => {
      this.deleteIgnoredCodeInformation();
    });
  }

  protected override async onCssInformationChanged(uri: Uri): Promise<void> {
    for (const tab of this.openTabs) {
      if (isCode(tab)) {
        const codeInfo = await this.getCodeInformation(tab);
        if (codeInfo?.cssModuleImports.some((i) => i.fsPath === uri.fsPath)) {
          await this.updateDiagnosticsForTab(tab);
        }
      }
    }
  }

  protected async getCodeInformation(
    uri: Uri,
    useCache = true,
  ): Promise<CodeInformation | undefined> {
    if (useCache && this.codeInformation.has(uri)) {
      return this.codeInformation.get(uri)!;
    }

    if (isCode(uri) && !this.isIgnored(uri)) {
      try {
        const codeInfo = await CodeInformation.create(uri);

        this.codeInformation.set(uri, codeInfo);
        return codeInfo;
      } catch (e) {
        this.logger.error(toError(e));
      }
    }
    return undefined;
  }

  public async allCodeInformation(): Promise<ReadonlyUriMap<CodeInformation>> {
    const op = `allCodeInformation(${this.folder.name})`;
    this.logger.trace(operation(op, 'start'));
    await this.findUnignoredFiles(`**/${globIsCode()}`).then(async (uris) => {
      for (const uri of uris) {
        if (isCode(uri)) {
          await this.getCodeInformation(uri, false);
        }
      }
    });
    this.logger.trace(operation(op, 'finish'));
    return this.codeInformation;
  }

  protected async codeInformationForCssModule(uri: Uri): Promise<CodeInformation[]> {
    const codeInfos: CodeInformation[] = [];

    for (const codeInfo of (await this.allCodeInformation()).values()) {
      if (codeInfo.cssModuleImports.some((i) => i.fsPath === uri.fsPath)) {
        codeInfos.push(codeInfo);
      }
    }
    return codeInfos;
  }

  public async deleteCodeInformation(uri: Uri): Promise<void> {
    this.codeInformation.delete(uri);
  }

  public deleteIgnoredCodeInformation(): void {
    for (const uri of Array.from(this.codeInformation.keys())) {
      if (this.isIgnored(uri)) {
        this.codeInformation.delete(uri);
      }
    }
  }

  public override async updateDiagnosticsForTab(uri: Uri): Promise<void> {
    await super.updateDiagnosticsForTab(uri);

    if (isCode(uri)) {
      const codeInfo = await this.getCodeInformation(uri, false);
      if (codeInfo) {
        const errors: Diagnostic[] = [];

        for (const importUri of codeInfo.cssModuleImports) {
          const cssInfo = await this.cssInformationForFile(importUri);
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
    const cssInfo = await this.cssInformationForFile(importUri);
    if (cssInfo) {
      const locations = cssInfo.cssLocations({ className, localName, importUri });
      if (locations) {
        for (const location of locations) {
          we.replace(location.uri, location.range, `.${cssReplacement}`);
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
