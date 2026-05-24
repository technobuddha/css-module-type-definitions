import path from 'node:path';

import { commands, type Disposable, Uri, workspace } from 'vscode';

import { config } from '../extension.ts';
import { generateTypes } from '../helpers/generate-types.ts';

export function commandUpdateTypes(): Disposable {
  return commands.registerCommand('cmtd.updateTypes', async () => {
    const { logger, globIsCss, globIsTypeDefinition } = config;

    const typedefs = new Set(
      (await config.findUnignoredFiles(`**/${globIsTypeDefinition}`)).map((uri) =>
        uri.toString(true),
      ),
    );

    await config.findUnignoredFiles(`**/${globIsCss}`).then(async (uris) => {
      for (const uri of uris) {
        const { dir, name, ext } = path.parse(uri.path);

        typedefs.delete(uri.with({ path: `${dir}/${name}.d${ext}.ts` }).toString(true));
        typedefs.delete(uri.with({ path: `${dir}/${name}.d${ext}.ts.map` }).toString(true));
        await generateTypes(uri);
      }
    });

    for (const pathname of typedefs) {
      await workspace.fs.delete(Uri.parse(pathname));
      logger.info(`Deleted orphaned type definition: ${pathname}`);
    }
  });
}
