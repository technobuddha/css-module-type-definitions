import { commands, type Disposable, window, workspace } from 'vscode';

import { type WorkspaceController } from '../controllers/workspace-controller.ts';

type CommandHideTypesFilesOptions = {
  controller: WorkspaceController;
};

export function commandHideTypeFiles({ controller }: CommandHideTypesFilesOptions): Disposable {
  return commands.registerCommand('cmtd.typeFiles.hide', async () => {
    for (const folder of workspace.workspaceFolders ?? []) {
      const pattern = `**/${controller.globIsTypeDefinition(folder)}`;
      const wsConfig = workspace.getConfiguration(undefined, folder);
      window.showInformationMessage('Type files will now be hidden in the explorer.');
      wsConfig.update('cmtd.showTypeFiles', false);
      wsConfig.update('files.exclude', { [pattern]: true });
    }
  });
}
