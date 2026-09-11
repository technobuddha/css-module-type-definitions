import {
  type CancellationToken,
  type DefinitionProvider,
  type Location,
  type Position,
  type TextDocument,
} from 'vscode';

import { isCssModule } from '../../common/file-types.ts';

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

        if (isCssModule(importUri)) {
          const cssInfo = folderController.cssInformation<CssModuleInformation>(importUri);
          if (cssInfo && !cssInfo.hasDts) {
            const exportNames = cssInfo.aliases({ localName });
            for (const exportName of exportNames) {
              const extracted = cssInfo.exports.get(exportName)?.map(({ location }) => location);
              if (extracted) {
                const [location] = extracted;
                return location;
              }
            }
          }
        }
      }
    }
    return null;
  }
}
