import { commands, type Disposable } from 'vscode';

import { type WorkspaceController } from '../controllers/index.ts';

type CommandUpdateTypesOptions = {
  readonly controller: WorkspaceController;
};

export function commandUpdateCssModuleTypeDefinitions({
  controller,
}: CommandUpdateTypesOptions): Disposable {
  return commands.registerCommand('cmtd.updateCssModuleTypeDefinitions', async () =>
    Promise.all(
      controller
        .folderControllers()
        .map(async (folderController) => folderController.updateAllCssModuleTypeDefinitionFiles()),
    ),
  );
}
