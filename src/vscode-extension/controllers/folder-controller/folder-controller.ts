import {
  type CancellationToken,
  type Disposable,
  Position,
  Range,
  type Uri,
  type WorkspaceEdit,
  type WorkspaceFolder,
} from 'vscode';

import { type LoggerController } from '../../../common/index.ts';

import { FolderCode } from './folder-code.ts';

type FolderControllerOptions = {
  folder: WorkspaceFolder;
  logger: LoggerController;
};

export class FolderController extends FolderCode implements Disposable {
  public static async create({
    folder,
    logger,
  }: FolderControllerOptions): Promise<FolderController> {
    const controller = new FolderController({ folder, logger });

    await super.init(controller);
    return controller;
  }

  public constructor({ folder, logger }: FolderControllerOptions) {
    super({ folder, logger });
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

      for (const [file, imports] of await this.allImports()) {
        if (token?.isCancellationRequested) {
          return;
        }

        if (imports.some((i) => i.fsPath === importUri.fsPath)) {
          const classUsages = await cssInfo.usages({
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
