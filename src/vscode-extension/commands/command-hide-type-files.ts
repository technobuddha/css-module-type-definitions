import { commands, type Disposable, window, workspace } from 'vscode';

import { config } from '../extension.ts';

export function commandHideTypeFiles(): Disposable {
  return commands.registerCommand('cmtd.typeFiles.hide', async () => {
    const pattern = `**/${config.globIsTypeDefinition}`;

    const wsConfig = workspace.getConfiguration();
    window.showInformationMessage('Type files will now be hidden in the explorer.');
    config.logger.log(JSON.stringify(wsConfig.get('cmtd.showTypeFiles')));

    wsConfig.update('cmtd.showTypeFiles', false);
    wsConfig.update('files.exclude', { [pattern]: true });
  });
}
