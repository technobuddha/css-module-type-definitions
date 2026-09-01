import { commands, type Disposable, window } from 'vscode';

import { type WorkspaceController } from '../controllers/index.ts';

type CommandUpdateTypesOptions = {
  readonly controller: WorkspaceController;
};

export function commandUpdateCssModuleTypeDefinitions({
  controller,
}: CommandUpdateTypesOptions): Disposable {
  return commands.registerCommand('cmtd.updateCssModuleTypeDefinitions', async () => {
    const choice = await window.showQuickPick(
      controller
        .folderControllers()
        .map((fc) => ({ label: fc.folder.name, picked: true, fc }))
        .toArray(),
      { canPickMany: true, placeHolder: 'Select folders to update CSS module type definitions' },
    );

    if (choice) {
      for (const { fc } of choice) {
        await fc.prepare();
        await fc.updateAllCssModuleTypeDefinitionFiles();
      }
    }
  });
}
