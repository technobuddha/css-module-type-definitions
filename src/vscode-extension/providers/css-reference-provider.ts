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
import { fileExists, getClassInfo, normalizeLocations } from '../helpers/index.ts';

type Arguments = {
  workspaceController: WorkspaceController;
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

        for (const importUri of await folderController.cssImporters(document.uri)) {
          const cssInfo = await folderController.cssInformation(importUri);
          if (cssInfo) {
            const { classLocal } = cssInfo;

            if (classLocal.has(className)) {
              for (const [file, codeInfo] of await folderController.allCodeInformation()) {
                if (token.isCancellationRequested) {
                  return [];
                }

                if (codeInfo.cssModuleImports.some((i) => i.fsPath === importUri.fsPath)) {
                  const classUsages = await cssInfo.classUsage({ className, file, importUri });
                  if (classUsages) {
                    for (const usage of classUsages.usages) {
                      locations.push(new Location(file, usage.range));
                    }
                  }

                  const dtsFile = Uri.joinPath(Utils.dirname(importUri), cssInfo.dtsFilename);
                  if (await fileExists(dtsFile)) {
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
