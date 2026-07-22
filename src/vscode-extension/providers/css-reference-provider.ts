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
import { fileExists, normalizeLocations } from '../helpers/index.ts';

type Arguments = {
  workspaceController: WorkspaceController;
};

export class CssReferenceProvider implements ReferenceProvider {
  readonly #workspaceController: WorkspaceController;

  public constructor(options: Arguments) {
    this.#workspaceController = options.workspaceController;
  }

  // TODO: include .d.ts file reference

  public async provideReferences(
    document: TextDocument,
    position: Position,
    _context: ReferenceContext,
    token: CancellationToken,
  ): Promise<Location[]> {
    const folderController = this.#workspaceController.folderController(document.uri);
    if (folderController) {
      const locations: Location[] = [];

      const range = document.getWordRangeAtPosition(position);
      if (range?.isSingleLine) {
        let className = document.getText(range);

        if (className.startsWith('.')) {
          className = className.slice(1);

          const importers =
            folderController.isCssModule(document.uri) ?
              [document.uri]
            : await folderController.getAllCssInformation().then((imports) =>
                imports
                  .entries()
                  .filter(([, info]) => info.includedFiles.has(document.uri.fsPath))
                  .map(([importer]) => Uri.file(importer))
                  .toArray(),
              );

          for (const importer of importers) {
            const cssInfo = await folderController.getCssInformation(importer);
            if (cssInfo) {
              const { classLocal } = cssInfo;

              if (classLocal.has(className)) {
                for (const [file, imports] of await folderController.allImports()) {
                  if (token.isCancellationRequested) {
                    return [];
                  }

                  if (imports.some((i) => i.fsPath === importer.fsPath)) {
                    const usages = await cssInfo.classUsages(className, file, importer);

                    for (const usage of usages) {
                      locations.push(new Location(Uri.file(file), usage.range));
                    }

                    const dtsFile = Uri.joinPath(Utils.dirname(importer), cssInfo.dtsFile);
                    if (await fileExists(dtsFile)) {
                      const ranges = cssInfo.classDtsRanges(className);
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
    }

    return [];
  }
}
