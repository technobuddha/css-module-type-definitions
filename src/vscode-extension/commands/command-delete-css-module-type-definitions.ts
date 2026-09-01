import { commands, type Disposable, window } from 'vscode';

import { type WorkspaceController } from '../controllers/index.ts';

type CommandDeleteTypesOptions = {
  readonly controller: WorkspaceController;
};

export function commandDeleteCssModuleTypeDefinitions({
  controller,
}: CommandDeleteTypesOptions): Disposable {
  return commands.registerCommand('cmtd.deleteCssModuleTypeDefinitions', async () => {
    const choice = await window.showQuickPick(
      controller
        .folderControllers()
        .map((fc) => ({ label: fc.folder.name, picked: true, fc }))
        .toArray(),
      { canPickMany: true, placeHolder: 'Select folders to delete CSS module type definitions' },
    );

    if (choice) {
      for (const { fc } of choice) {
        await fc.prepare();
        await fc.deleteAllCssModuleTypeDefinitionFiles();
      }
    }
  });
}
