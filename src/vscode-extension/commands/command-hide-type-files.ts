import { commands, type Disposable, window, workspace } from 'vscode';

import { globIsTypeDefinition } from '../../common/index.ts';

import { type WorkspaceController } from '../controllers/index.ts';

type CommandHideTypesFilesOptions = {
  controller: WorkspaceController;
};

export function commandHideTypeFiles({ controller }: CommandHideTypesFilesOptions): Disposable {
  return commands.registerCommand('cmtd.typeFiles.hide', async () => {
    for (const folder of workspace.workspaceFolders ?? []) {
      const folderController = controller.folders.get(folder);
      if (folderController) {
        const pattern = `**/${globIsTypeDefinition()}`;
        const wsConfig = workspace.getConfiguration(undefined, folder);
        window.showInformationMessage('Type files will now be hidden in the explorer.');
        wsConfig.update('cmtd.showTypeFiles', false);
        wsConfig.update('files.exclude', { [pattern]: true });
      }
    }
  });
}
