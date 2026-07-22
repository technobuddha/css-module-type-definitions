import { splitLines } from '@technobuddha/library';
import {
  type CancellationToken,
  Location,
  type Position,
  type ReferenceContext,
  type ReferenceProvider,
  type TextDocument,
  Uri,
  workspace,
} from 'vscode';

import { type WorkspaceController } from '../controllers/workspace-controller.ts';
import { normalizeLocations } from '../helpers/normalize-locations.ts';

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
        let className = splitLines(document.getText())[range.start.line].slice(
          range.start.character,
          range.end.character,
        );

        if (className.startsWith('.')) {
          className = className.slice(1);

          const importers =
            folderController.isCssModule(document.uri) ?
              [document.uri]
            : await folderController.getMissingCssInformation().then((imports) =>
                imports
                  .entries()
                  .filter(([, types]) => types.includedFiles.has(document.uri.fsPath))
                  .map(([importer]) => Uri.file(importer))
                  .toArray(),
              );

          for (const importer of importers) {
            const info = await folderController.getCssInformation(importer);
            if (info) {
              const { classLocal } = info;

              if (classLocal.has(className)) {
                const alternates = new Set(classLocal.get(className));

                for (const [file, imports] of await folderController.allImports()) {
                  if (token.isCancellationRequested) {
                    return [];
                  }

                  if (imports.some((i) => i.fsPath === importer.fsPath)) {
                    const textDocument = await workspace.openTextDocument(file);
                    const usages = await info.localUsages(textDocument, importer, alternates);

                    for (const usage of usages) {
                      locations.push(new Location(Uri.file(file), usage.range));
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
