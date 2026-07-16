import {
  type CancellationToken,
  type DefinitionProvider,
  Location,
  Position,
  type TextDocument,
  Uri,
} from 'vscode';
import { Utils } from 'vscode-uri';

import { type WorkspaceController } from '../controllers/index.ts';

import { getClassInfo } from './helpers/get-class-info.ts';

type Arguments = {
  workspaceController: WorkspaceController;
};

export class CodeDefinitionProvider implements DefinitionProvider {
  readonly #workspaceController: WorkspaceController;

  public constructor({ workspaceController }: Arguments) {
    this.#workspaceController = workspaceController;
  }

  public async provideDefinition(
    document: TextDocument,
    position: Position,
    _token: CancellationToken,
  ): Promise<Location | null> {
    const folderController = this.#workspaceController.folderController(document.uri);
    if (folderController?.options.cssModules.generateDts === false) {
      const clickInfo = await getClassInfo(document, position);
      if (clickInfo) {
        const { importUri, className } = clickInfo;

        const types = await folderController.getTypes(importUri);
        if (types) {
          const { classes } = types;
          const extracted = classes.get(className);
          if (extracted) {
            const [{ location: { source, range: { start } } }] = extracted;

            const target = Uri.joinPath(Utils.dirname(importUri), source);

            return new Location(target, new Position(start.line - 1, start.column));
          }
        }
      }
    }
    return null;
  }
}
