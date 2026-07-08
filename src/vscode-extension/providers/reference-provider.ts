import {
  type CancellationToken,
  Location,
  type Position,
  type ReferenceContext,
  type ReferenceProvider,
  type TextDocument,
  workspace,
} from 'vscode';

import { CODE_EXTENSIONS } from '../../common/constants.ts';

import { type WorkspaceController } from '../controllers/workspace-controller.ts';

import { findClassUsages } from './helpers/find-class-usages.ts';
import { getClassInfo } from './helpers/get-class-info.ts';
import { classReferenceInfo } from './helpers/lib/class-reference-info.ts';
import { normalizeLocations } from './helpers/lib/normalize-locations.ts';
import { scanImports } from './helpers/scan-imports.ts';

type CSSReferenceProviderOptions = {
  workspaceController: WorkspaceController;
};

export class CSSReferenceProvider implements ReferenceProvider {
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

        const types = await folderController.getTypes(importUri);
        const { classNames, declarationLocation } = classReferenceInfo(types, importUri, className);

        if (context.includeDeclaration) {
          if (declarationLocation) {
            locations.push(declarationLocation);
          }
        }

        for (const file of await folderController.findUnignoredFiles(
          `**/*{${CODE_EXTENSIONS.join(',')}}`,
        )) {
          if (token.isCancellationRequested) {
            return [];
          }

          for (const imported of await scanImports(file)) {
            if (imported.fsPath === importUri.fsPath) {
              for (const usage of await findClassUsages(
                await workspace.openTextDocument(file),
                importUri,
                classNames,
              )) {
                if (accessorType === 'element' && usage.accessorType === accessorType) {
                  continue;
                }

                locations.push(new Location(file, usage.range));
              }
              break;
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
