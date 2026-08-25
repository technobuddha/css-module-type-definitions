import { commands, ConfigurationTarget, type Disposable, workspace } from 'vscode';

export function commandHideGitIgnore(): Disposable {
  return commands.registerCommand('cmtd.hideGitIgnore', async () => {
    const wsConfig = workspace.getConfiguration();
    wsConfig.update('explorer.excludeGitIgnore', true, ConfigurationTarget.Global);
  });
}
