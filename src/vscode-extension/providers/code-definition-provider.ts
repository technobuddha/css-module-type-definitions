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
import { getLocalInfo } from '../helpers/index.ts';

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
    if (folderController) {
      const localInfo = await getLocalInfo(document, position);
      if (localInfo) {
        const { importUri, localName } = localInfo;

        const cssInfo = await folderController.getCssInformation(importUri);
        if (cssInfo?.hasDts === false) {
          const { classLocations } = cssInfo;
          const extracted = classLocations.get(localName);
          if (extracted) {
            const [
              {
                location: {
                  source,
                  range: { start },
                },
              },
            ] = extracted;

            const target = Uri.joinPath(Utils.dirname(importUri), source);

            return new Location(target, new Position(start.line, start.column));
          }
        }
      }
    }
    return null;
  }
}
