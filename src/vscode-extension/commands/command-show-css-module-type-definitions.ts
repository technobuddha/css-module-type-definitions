import { commands, ConfigurationTarget, type Disposable, window, workspace } from 'vscode';

export function commandShowCssModuleTypeDefinitions(): Disposable {
  return commands.registerCommand('cmtd.showCssModuleTypeDefinitions', async () => {
    const wsConfig = workspace.getConfiguration();
    window.showInformationMessage('Type files will now be shown in the explorer.');
    wsConfig.update('cmtd.showCssModuleTypeDefinitions', undefined, ConfigurationTarget.Global);
    wsConfig.update('files.exclude', undefined, ConfigurationTarget.Global);
  });
}
