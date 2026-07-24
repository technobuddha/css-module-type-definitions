import {
  type CancellationToken,
  Location,
  type Position,
  type ReferenceContext,
  type ReferenceProvider,
  type TextDocument,
  Uri,
} from 'vscode';
import { Utils } from 'vscode-uri';

import { type WorkspaceController } from '../controllers/workspace-controller.ts';
import { fileExists, getLocalInfo, normalizeLocations } from '../helpers/index.ts';

type Arguments = {
  workspaceController: WorkspaceController;
};

export class CodeReferenceProvider implements ReferenceProvider {
  readonly #workspaceController: WorkspaceController;

  public constructor(options: Arguments) {
    this.#workspaceController = options.workspaceController;
  }

  public async provideReferences(
    document: TextDocument,
    position: Position,
    context: ReferenceContext,
    token: CancellationToken,
  ): Promise<Location[]> {
    const folderController = this.#workspaceController.folderController(document.uri);
    if (folderController) {
      const localInfo = await getLocalInfo(document, position);
      if (localInfo) {
        const { localName, importUri, accessorType } = localInfo;
        const locations: Location[] = [];

        const cssInfo = await folderController.getCssInformation(importUri);
        if (cssInfo) {
          const cssLocations = cssInfo.cssLocations(localName, importUri);
          if (cssLocations) {
            if (context.includeDeclaration) {
              for (const cssLocation of cssLocations.values()) {
                locations.push(...cssLocation);
              }
            }

            for (const [file, imports] of await folderController.allImports()) {
              if (token.isCancellationRequested) {
                return [];
              }

              if (imports.some((i) => i.fsPath === importUri.fsPath)) {
                const localUsages = await cssInfo.localUsages(localName, file, importUri);
                if (localUsages) {
                  for (const usage of localUsages.usages) {
                    if (accessorType === 'property' || usage.accessorType !== accessorType) {
                      locations.push(new Location(Uri.file(file), usage.range));
                    }
                  }
                }
              }
            }
          }

          const dtsFile = Uri.joinPath(Utils.dirname(importUri), cssInfo.dtsFile);
          if (await fileExists(dtsFile)) {
            const ranges = cssInfo.localDtsRanges(localName);
            for (const range of ranges) {
              locations.push(new Location(dtsFile, range));
            }
          }

          const normalizedLocations = normalizeLocations(locations);

          if (!context.includeDeclaration) {
            return normalizedLocations.filter((location) => {
              if (location.uri.fsPath !== document.uri.fsPath) {
                return true;
              }

              return !location.range.contains(position);
            });
          }

          return normalizedLocations;
        }
      }
    }

    return [];
  }
}
