import { commands, type Disposable, window, workspace } from 'vscode';

import { config } from '../extension.ts';

export function commandHideTypeFiles(): Disposable {
  return commands.registerCommand('cmtd.typeFiles.hide', async () => {
    for (const folder of workspace.workspaceFolders ?? []) {
      const pattern = `**/${config.globIsTypeDefinition(folder)}`;
      const wsConfig = workspace.getConfiguration(undefined, folder);
      window.showInformationMessage('Type files will now be hidden in the explorer.');
      wsConfig.update('cmtd.showTypeFiles', false);
      wsConfig.update('files.exclude', { [pattern]: true });
    }
  });
}
