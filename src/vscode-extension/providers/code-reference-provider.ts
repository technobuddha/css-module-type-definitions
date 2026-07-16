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

import { findClassUsages } from './helpers/find-class-usages.ts';
import { getClassInfo } from './helpers/get-class-info.ts';
import { classReferenceInfo } from './helpers/lib/class-reference-info.ts';
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
      const classInfo = await getClassInfo(document, position);
      if (classInfo) {
        const { importUri, className, accessorType } = classInfo;
        const locations: Location[] = [];

        // TODO Add references to the .dts file (if exists) for aliases

        const types = await folderController.getTypes(importUri);
        const cri = classReferenceInfo(types, importUri, className);
        if (cri) {
          const { classNames, declarationLocations } = cri;

          if (context.includeDeclaration) {
            for (const declarationLocation of declarationLocations) {
              locations.push(declarationLocation);
            }
          }

          await folderController.getAllImports();

          for (const [file, imports] of folderController.imports) {
            if (token.isCancellationRequested) {
              return [];
            }

            if (imports.some((i) => i.fsPath === importUri.fsPath)) {
              for (const usage of await findClassUsages(
                await workspace.openTextDocument(file),
                importUri,
                classNames,
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

    return [];
  }
}
