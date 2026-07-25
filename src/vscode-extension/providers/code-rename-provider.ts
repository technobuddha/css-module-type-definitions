import {
  type CancellationToken,
  type Position,
  type RenameProvider,
  type TextDocument,
  WorkspaceEdit,
} from 'vscode';

import { type WorkspaceController } from '../controllers/workspace-controller.ts';
import { getLocalInfo, replacementName } from '../helpers/index.ts';

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
      const { options } = folderController;

      const { cssReplacement, codeReplacement } = replacementName(newName, options);

      const localInfo = await getLocalInfo(document, position);
      if (localInfo) {
        const { importUri, localName } = localInfo;
        const we = new WorkspaceEdit();

        await folderController.edit({
          we,
          importUri,
          codeReplacement,
          cssReplacement,
          localName,
          token,
        });

        return we;
      }
    }

    return null;
  }
}
