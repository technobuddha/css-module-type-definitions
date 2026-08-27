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

import { isCssModule } from '../../common/file-types.ts';

import { type WorkspaceController } from '../controllers/index.ts';
import { getClassInfo, normalizeLocations, vscodeFileExists } from '../helpers/index.ts';
import { type CssModuleInformation } from '../information/index.ts';

type Arguments = {
  readonly workspaceController: WorkspaceController;
};

export class CssReferenceProvider implements ReferenceProvider {
  readonly #workspaceController: WorkspaceController;

  public constructor(options: Arguments) {
    this.#workspaceController = options.workspaceController;
  }

  public async provideReferences(
    document: TextDocument,
    position: Position,
    _context: ReferenceContext,
    token: CancellationToken,
  ): Promise<Location[]> {
    const folderController = this.#workspaceController.folderController(document.uri);
    if (folderController) {
      const locations: Location[] = [];

      const classInfo = getClassInfo(document, position);
      if (classInfo) {
        const { className } = classInfo;

        for (const importUri of folderController.filesImporting(document.uri)) {
          const cssInfo = folderController.cssInformation(importUri) as CssModuleInformation;
          if (cssInfo) {
            const { classLocal } = cssInfo;

            if (classLocal.has(className)) {
              for (const [file, codeInfo] of await folderController.allCodeInformation()) {
                if (token.isCancellationRequested) {
                  return [];
                }

                if (isCssModule(importUri) && codeInfo.importedFiles.has(importUri)) {
                  const classUsages = await cssInfo.classUsage({ className, file, importUri });
                  if (classUsages) {
                    for (const usage of classUsages.usages) {
                      locations.push(new Location(file, usage.range));
                    }
                  }

                  const dtsFile = Uri.joinPath(Utils.dirname(importUri), cssInfo.dtsFilename);
                  if (await vscodeFileExists(dtsFile)) {
                    const ranges = cssInfo.dtsRanges({ className });
                    for (const range of ranges) {
                      locations.push(new Location(dtsFile, range));
                    }
                  }
                }
              }
            }
          }
        }

        return normalizeLocations(locations);
      }
    }

    return [];
  }
}
