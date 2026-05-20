import { plural } from '@technobuddha/library';
import { commands, type Disposable, window, workspace } from 'vscode';

import { config } from '../extension.ts';
import { generateTypes } from '../helpers/generate-types.ts';

export function commandCreateTypes(): Disposable {
  return commands.registerCommand('cmtd.generateTypes', async () => {
    const { logger, globIsCss } = config;

    logger.log('command executed');

    const pattern = `**/${globIsCss}`;

    await workspace.findFiles(pattern).then(async (uris) => {
      for (const uri of uris) {
        logger.log(`Found file: ${uri.fsPath}`);
        await generateTypes(uri);
      }
      window.showInformationMessage(`Generated types for ${plural('file', uris.length, true)}`);
    });
  });
}
