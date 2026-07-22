import {
  type CancellationToken,
  type Position,
  type RenameProvider,
  type TextDocument,
  Uri,
  WorkspaceEdit,
} from 'vscode';

import { type WorkspaceController } from '../controllers/workspace-controller.ts';
import { getLocalInfo } from '../helpers/index.ts';

type Arguments = {
  workspaceController: WorkspaceController;
};

export class CodeRenameProvider implements RenameProvider {
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
      const { logger } = folderController;

      const localInfo = await getLocalInfo(document, position);
      if (localInfo) {
        const { importUri, localName } = localInfo;

        const info = await folderController.getCssInformation(importUri);
        if (info) {
          const cssLocations = info.cssLocations(localName, importUri);
          if (cssLocations) {
            const we = new WorkspaceEdit();

            for (const locs of cssLocations.values()) {
              for (const loc of locs) {
                logger.debug(
                  `${localName} ${importUri.fsPath} ${loc.uri.fsPath}:${loc.range.start.line}:${loc.range.start.character}=>${loc.range.end.line}:${loc.range.end.character} => ${newName}`,
                );
                we.replace(loc.uri, loc.range, `.${newName}`);
              }
            }

            for (const [file, imports] of await folderController.allImports()) {
              if (token.isCancellationRequested) {
                return null;
              }

              if (imports.some((i) => i.fsPath === importUri.fsPath)) {
                for (const usage of await info.localUsages(localName, file, importUri)) {
                  we.replace(Uri.file(file), usage.range, newName);
                }
              }
            }
            return we;
          }
        }
      }
    }

    return null;
  }
}
