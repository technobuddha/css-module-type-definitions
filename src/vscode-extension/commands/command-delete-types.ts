import { commands, type Disposable } from 'vscode';

import { type WorkspaceController } from '../controllers/index.ts';

type CommandDeleteTypesOptions = {
  controller: WorkspaceController;
};

export function commandDeleteTypes({ controller }: CommandDeleteTypesOptions): Disposable {
  return commands.registerCommand('cmtd.deleteTypes', async () =>
    Promise.all(controller.folderControllers().map(async (folder) => folder.deleteAllDts())),
  );
}
