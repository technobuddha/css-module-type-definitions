import path from 'node:path';

import { commands, type Disposable, Uri, workspace } from 'vscode';

import { type WorkspaceController } from '../controllers/workspace-controller.ts';
import { generateTypes } from '../helpers/generate-types.ts';

type CommandUpdateTypesOptions = {
  controller: WorkspaceController;
};

export function commandUpdateTypes({ controller }: CommandUpdateTypesOptions): Disposable {
  return commands.registerCommand('cmtd.updateTypes', async () => {
    for (const folder of workspace.workspaceFolders ?? []) {
      const typedefs = new Set(
        (
          await controller.findUnignoredFiles(
            folder,
            `**/${controller.globIsTypeDefinition(folder)}`,
          )
        ).map((uri) => uri.toString(true)),
      );

      await controller
        .findUnignoredFiles(folder, `**/${controller.globIsCss(folder)}`)
        .then(async (uris) => {
          for (const uri of uris) {
            const { dir, name, ext } = path.parse(uri.path);

            typedefs.delete(uri.with({ path: `${dir}/${name}.d${ext}.ts` }).toString(true));
            typedefs.delete(uri.with({ path: `${dir}/${name}.d${ext}.ts.map` }).toString(true));
            await generateTypes(uri, {
              logger: controller.logger,
              options: controller.options(folder),
            });
          }
        });

      for (const pathname of typedefs) {
        await workspace.fs.delete(Uri.parse(pathname));
        controller.logger.info(`Deleted orphaned type definition: ${pathname}`);
      }
    }
  });
}
