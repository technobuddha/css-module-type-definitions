import { commands, type Disposable } from 'vscode';

import { type WorkspaceController } from '../controllers/index.ts';

type CommandUpdateTypesOptions = {
  controller: WorkspaceController;
};

export function commandUpdateTypes({ controller }: CommandUpdateTypesOptions): Disposable {
  return commands.registerCommand('cmtd.updateTypes', async () =>
    Promise.all(
      controller
        .folderControllers()
        .map(async (folderController) => folderController.updateCssTypeDefinitions()),
    ),
  );
}
