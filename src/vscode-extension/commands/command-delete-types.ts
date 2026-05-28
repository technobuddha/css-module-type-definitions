import { commands, type Disposable, workspace } from 'vscode';

import { config } from '../extension.ts';

export function commandDeleteTypes(): Disposable {
  return commands.registerCommand('cmtd.deleteTypes', async () => {
    const { logger } = config;
    for (const folder of workspace.workspaceFolders ?? []) {
      await config
        .findUnignoredFiles(folder, `**/${config.globIsTypeDefinition(folder)}`)
        .then(async (uris) => {
          for (const uri of uris) {
            logger.info(`Deleted file: ${uri.fsPath}`);
            await workspace.fs.delete(uri);
          }
        });
    }
  });
}
