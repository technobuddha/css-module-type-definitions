import { commands, ConfigurationTarget, type Disposable, workspace } from 'vscode';

export function commandShowGitIgnore(): Disposable {
  return commands.registerCommand('cmtd.showGitIgnore', async () => {
    const wsConfig = workspace.getConfiguration();
    wsConfig.update('explorer.excludeGitIgnore', false, ConfigurationTarget.Global);
  });
}
