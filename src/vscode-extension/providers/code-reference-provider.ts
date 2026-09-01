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

import { type WorkspaceController } from '../controllers/index.ts';
import { getLocalInfo, normalizeLocations, vscodeFileExists } from '../helpers/index.ts';
import { type CssModuleInformation } from '../information/index.ts';

type Arguments = {
  readonly workspaceController: WorkspaceController;
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
    _token: CancellationToken,
  ): Promise<Location[]> {
    const folderController = this.#workspaceController.folderController(document.uri);
    if (folderController) {
      const localInfo = await getLocalInfo(document, position);
      if (localInfo) {
        const { localName, importUri, accessorType } = localInfo;
        const locations: Location[] = [];

        const cssInfo = folderController.cssInformation<CssModuleInformation>(importUri);
        if (cssInfo) {
          const cssLocations = cssInfo.cssLocations({ localName, importUri });
          if (cssLocations) {
            if (context.includeDeclaration) {
              locations.push(...cssLocations);
            }

            await folderController.allCodeInformation();
            const importers = folderController.codeFilesImporting(importUri);
            for (const importer of importers) {
              const codeInfo = folderController.codeInformation(importer);
              if (codeInfo) {
                const { file } = codeInfo;
                const localUsages = await cssInfo.classUsage({ localName, file, importUri });
                if (localUsages) {
                  for (const usage of localUsages.usages) {
                    if (accessorType === 'property' || usage.accessorType !== accessorType) {
                      locations.push(new Location(file, usage.range));
                    }
                  }
                }
              }
            }
          }

          const dtsFile = Uri.joinPath(Utils.dirname(importUri), cssInfo.dtsFilename);
          if (await vscodeFileExists(dtsFile)) {
            const ranges = cssInfo.dtsRanges({ localName });
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
