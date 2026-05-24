import { commands, type Disposable, workspace } from 'vscode';

import { config } from '../extension.ts';

export function commandDeleteTypes(): Disposable {
  return commands.registerCommand('cmtd.deleteTypes', async () => {
    const { logger, globIsTypeDefinition } = config;

    await config.findUnignoredFiles(`**/${globIsTypeDefinition}`).then(async (uris) => {
      for (const uri of uris) {
        logger.info(`Deleted file: ${uri.fsPath}`);
        await workspace.fs.delete(uri);
      }
    });
  });
}
