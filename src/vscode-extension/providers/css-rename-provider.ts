import {
  type CancellationToken,
  type Position,
  Range,
  type RenameProvider,
  type TextDocument,
  WorkspaceEdit,
} from 'vscode';

import { type WorkspaceController } from '../controllers/workspace-controller.ts';
import { getClassInfo, replacementName } from '../helpers/index.ts';

type Arguments = {
  readonly workspaceController: WorkspaceController;
};

export class CssRenameProvider implements RenameProvider {
  readonly #workspaceController: WorkspaceController;

  public constructor(options: Arguments) {
    this.#workspaceController = options.workspaceController;
  }

  public async prepareRename(
    document: TextDocument,
    position: Position,
    _token: CancellationToken,
  ): Promise<Range | null> {
    const range = document.getWordRangeAtPosition(position);

    if (range) {
      return new Range(
        range.start.line,
        range.start.character + 1,
        range.end.line,
        range.end.character,
      );
    }
    return null;
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

        for (const importUri of folderController.filesImporting(document.uri)) {
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
