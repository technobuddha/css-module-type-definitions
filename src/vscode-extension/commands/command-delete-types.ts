import { commands, type Disposable, workspace } from 'vscode';

import { type WorkspaceController } from '../controllers/workspace-controller.ts';

type CommandDeleteTypesOptions = {
  controller: WorkspaceController;
};

export function commandDeleteTypes({ controller }: CommandDeleteTypesOptions): Disposable {
  return commands.registerCommand('cmtd.deleteTypes', async () => {
    for (const folder of workspace.workspaceFolders ?? []) {
      await controller
        .findUnignoredFiles(folder, `**/${controller.globIsTypeDefinition(folder)}`)
        .then(async (uris) => {
          for (const uri of uris) {
            controller.logger.info(`Deleted file: ${uri.fsPath}`);
            await workspace.fs.delete(uri);
          }
        });
    }
  });
}
