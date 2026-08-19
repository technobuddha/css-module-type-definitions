import { commands, ConfigurationTarget, type Disposable, window, workspace } from 'vscode';

import { globIsCssTypeDefinition } from '../../common/index.ts';

export function commandHideCssModuleTypeDefinitions(): Disposable {
  return commands.registerCommand('cmtd.hideCssModuleTypeDefinitions', async () => {
    const pattern = `**/${globIsCssTypeDefinition()}`;
    const wsConfig = workspace.getConfiguration();
    window.showInformationMessage('Type files will now be hidden in the explorer.');
    wsConfig.update('cmtd.showCssModuleTypeDefinitions', false, ConfigurationTarget.Global);
    wsConfig.update('files.exclude', { [pattern]: true }, ConfigurationTarget.Global);
  });
}
