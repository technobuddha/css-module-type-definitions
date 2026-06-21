import { commands, type Disposable, window, workspace } from 'vscode';

import { type WorkspaceController } from '../controllers/workspace-controller.ts';

type CommandShowTypesFilesOptions = {
  controller: WorkspaceController;
};

export function commandShowTypeFiles({ controller }: CommandShowTypesFilesOptions): Disposable {
  return commands.registerCommand('cmtd.typeFiles.show', async () => {
    const wsConfig = workspace.getConfiguration();
    window.showInformationMessage('Type files will now be shown in the explorer.');
    controller.logger.debug(JSON.stringify(wsConfig.get('cmtd.showTypeFiles')));
    wsConfig.update('cmtd.showTypeFiles', true);
    wsConfig.update('files.exclude', undefined);
  });
}
