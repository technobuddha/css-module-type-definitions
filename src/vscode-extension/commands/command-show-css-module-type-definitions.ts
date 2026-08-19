import { commands, ConfigurationTarget, type Disposable, workspace } from 'vscode';

export function commandShowCssModuleTypeDefinitions(): Disposable {
  return commands.registerCommand('cmtd.showCssModuleTypeDefinitions', async () => {
    const wsConfig = workspace.getConfiguration();
    wsConfig.update('cmtd.showCssModuleTypeDefinitions', undefined, ConfigurationTarget.Global);
    wsConfig.update('files.exclude', undefined, ConfigurationTarget.Global);
  });
}
