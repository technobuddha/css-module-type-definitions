import {
  type CancellationToken,
  Position,
  Range,
  type RenameProvider,
  type TextDocument,
  WorkspaceEdit,
} from 'vscode';

import { type WorkspaceController } from '../controllers/workspace-controller.ts';
import { getClassInfo, replacementName } from '../helpers/index.ts';

type Arguments = {
  workspaceController: WorkspaceController;
};

export class CssRenameProvider implements RenameProvider {
  readonly #workspaceController: WorkspaceController;

  public constructor(options: Arguments) {
    this.#workspaceController = options.workspaceController;
  }

  public async provideRenameEdits(
    document: TextDocument,
    position: Position,
    newName: string,
    token: CancellationToken,
  ): Promise<WorkspaceEdit | null> {
    const folderController = this.#workspaceController.folderController(document.uri);
    if (folderController) {
      const { options } = folderController;

      const { cssName, codeName } = replacementName(newName, options);

      const classInfo = getClassInfo(document, position);
      if (classInfo) {
        const { className } = classInfo;
        const we = new WorkspaceEdit();

        for (const importer of await folderController.importers(document.uri)) {
          const cssInfo = await folderController.getCssInformation(importer);
          if (cssInfo) {
            const locations = cssInfo.classLocations.get(className);
            if (locations) {
              for (const location of locations) {
                const range = new Range(
                  new Position(
                    location.location.range.start.line,
                    location.location.range.start.column,
                  ),
                  new Position(
                    location.location.range.end.line,
                    location.location.range.end.column,
                  ),
                );
                we.replace(importer, range, `.${cssName}`);
              }
            }

            for (const [file, imports] of await folderController.allImports()) {
              if (token.isCancellationRequested) {
                return null;
              }

              if (imports.some((i) => i.fsPath === importer.fsPath)) {
                const classUsages = await cssInfo.classUsages(className, file, importer);
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
                        we.replace(document.uri, expandedRange, codeName);
                        continue;
                      }
                    }

                    if (range.start.character >= 1) {
                      const expandedRange = new Range(
                        new Position(range.start.line, range.start.character - 1),
                        new Position(range.end.line, range.end.character),
                      );

                      if (/^\..*$/v.test(document.getText(expandedRange))) {
                        we.replace(document.uri, expandedRange, codeName);
                      }
                    }
                  }
                }
              }
            }
          }
        }
        return we;
      }
    }

    return null;
  }
}
