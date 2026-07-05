import { commands, type Disposable, window, workspace } from 'vscode';

export function commandShowTypeFiles(): Disposable {
  return commands.registerCommand('cmtd.typeFiles.show', async () => {
    const wsConfig = workspace.getConfiguration();
    window.showInformationMessage('Type files will now be shown in the explorer.');
    wsConfig.update('cmtd.showTypeFiles', true);
    wsConfig.update('files.exclude', undefined);
  });
}
