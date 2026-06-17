import { commands, type Disposable, window, workspace } from 'vscode';

import { config } from '../controllers/configuration-controller.ts';

export function commandShowTypeFiles(): Disposable {
  return commands.registerCommand('cmtd.typeFiles.show', async () => {
    const wsConfig = workspace.getConfiguration();
    window.showInformationMessage('Type files will now be shown in the explorer.');
    config.logger.debug(JSON.stringify(wsConfig.get('cmtd.showTypeFiles')));
    wsConfig.update('cmtd.showTypeFiles', true);
    wsConfig.update('files.exclude', undefined);
  });
}
