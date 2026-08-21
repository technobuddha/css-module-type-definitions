import { commands, type Disposable } from 'vscode';

import { type WorkspaceController } from '../controllers/index.ts';

type CommandDeleteTypesOptions = {
  readonly controller: WorkspaceController;
};

export function commandDeleteCssModuleTypeDefinitions({
  controller,
}: CommandDeleteTypesOptions): Disposable {
  return commands.registerCommand('cmtd.deleteCssModuleTypeDefinitions', async () =>
    Promise.all(
      controller
        .folderControllers()
        .map(async (folder) => folder.deleteAllCssModuleTypeDefinitionFiles()),
    ),
  );
}
