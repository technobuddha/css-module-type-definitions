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
import { type CssModuleInformation } from '../information/index.ts';

type Arguments = {
  readonly workspaceController: WorkspaceController;
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

        const cssInfo = folderController.cssInformation(importUri) as CssModuleInformation;
        if (!cssInfo?.hasDts) {
          const { locationsOfClass } = cssInfo;
          const extracted = locationsOfClass.get(localName);
          if (extracted) {
            const [{ location }] = extracted;

            const target = Uri.joinPath(Utils.dirname(importUri), location.source);

            return new Location(
              target,
              new Position(location.range.start.line, location.range.start.column),
            );
          }
        }
      }
    }
    return null;
  }
}
