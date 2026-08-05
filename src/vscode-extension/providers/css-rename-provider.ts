import {
  type CancellationToken,
  type Position,
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

      const classInfo = getClassInfo(document, position);
      if (classInfo) {
        const { className } = classInfo;
        const { cssReplacement, codeReplacement } = replacementName(newName, options);
        const we = new WorkspaceEdit();

        for (const importUri of await folderController.importers(document.uri)) {
          await folderController.edit({
            we,
            importUri,
            codeReplacement,
            cssReplacement,
            className,
            token,
          });
        }

        return we;
      }
    }

    return null;
  }
}
