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

import { getLocalInfo } from './helpers/get-local-info.ts';
import { normalizeLocations } from './helpers/lib/normalize-locations.ts';

type CSSReferenceProviderOptions = {
  workspaceController: WorkspaceController;
};

export class CodeReferenceProvider implements ReferenceProvider {
  readonly #workspaceController: WorkspaceController;

  public constructor(options: CSSReferenceProviderOptions) {
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
        const { importUri, localName, accessorType } = localInfo;
        const locations: Location[] = [];

        // TODO Add references to the .dts file (if exists) for classLocal

        const info = await folderController.getCssInformation(importUri);
        if (info) {
          const cssLocations = info.cssLocations(localName, importUri);
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
                for (const usage of await info.localUsages(
                  await workspace.openTextDocument(file),
                  importUri,
                  info.localNames(cssLocations.keys()),
                )) {
                  if (accessorType === 'element' && usage.accessorType === accessorType) {
                    continue;
                  }

                  locations.push(new Location(Uri.file(file), usage.range));
                }
              }
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
