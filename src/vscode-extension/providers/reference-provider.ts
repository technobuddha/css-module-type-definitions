import fs from 'node:fs';
import path from 'node:path';

import {
  type CancellationToken,
  Location,
  Position,
  type ReferenceContext,
  type ReferenceProvider,
  type TextDocument,
  Uri,
  workspace,
} from 'vscode';
import { Utils } from 'vscode-uri';

import { CODE_EXTENSIONS } from '../../common/constants.ts';

import { type FolderController } from '../controllers/folder-controller.ts';
import { type WorkspaceController } from '../controllers/workspace-controller.ts';

import { scanImports } from './helpers/scan-imports.ts';
import { TSExtractor } from './helpers/ts-extractor.ts';

type CSSReferenceProviderOptions = {
  workspaceController: WorkspaceController;
};

export class CSSReferenceProvider implements ReferenceProvider {
  readonly #workspaceController: WorkspaceController;

  public constructor(options: CSSReferenceProviderOptions) {
    this.#workspaceController = options.workspaceController;
  }

  private canonicalPath(filePath: string): string {
    try {
      return path.normalize(fs.realpathSync.native(filePath));
    } catch {
      return path.normalize(filePath);
    }
  }

  private isDuplicateLocation(left: Location, right: Location): boolean {
    if (left.uri.fsPath !== right.uri.fsPath) {
      return false;
    }

    if (left.range.start.line !== right.range.start.line) {
      return false;
    }

    if (left.range.end.line !== right.range.end.line) {
      return false;
    }

    return (
      left.range.start.character <= right.range.end.character &&
      right.range.start.character <= left.range.end.character
    );
  }

  private preferLocation(left: Location, right: Location): Location {
    const leftWidth =
      (left.range.end.line - left.range.start.line) * Number.MAX_SAFE_INTEGER +
      (left.range.end.character - left.range.start.character);
    const rightWidth =
      (right.range.end.line - right.range.start.line) * Number.MAX_SAFE_INTEGER +
      (right.range.end.character - right.range.start.character);

    return rightWidth < leftWidth ? right : left;
  }

  private normalizeLocations(locations: Location[]): Location[] {
    const unique = new Map<string, { canonicalPath: string; location: Location }>();

    for (const location of locations) {
      const canonicalPath = this.canonicalPath(location.uri.fsPath);
      const key = [
        canonicalPath,
        location.range.start.line,
        location.range.start.character,
        location.range.end.line,
        location.range.end.character,
      ].join(':');

      unique.set(key, { canonicalPath, location });
    }

    const sorted = unique
      .values()
      .toArray()
      .sort((left, right) => {
        if (left.canonicalPath !== right.canonicalPath) {
          return left.canonicalPath.localeCompare(right.canonicalPath);
        }

        if (left.location.range.start.line !== right.location.range.start.line) {
          return left.location.range.start.line - right.location.range.start.line;
        }

        if (left.location.range.start.character !== right.location.range.start.character) {
          return left.location.range.start.character - right.location.range.start.character;
        }

        if (left.location.range.end.line !== right.location.range.end.line) {
          return left.location.range.end.line - right.location.range.end.line;
        }

        return left.location.range.end.character - right.location.range.end.character;
      });

    const deduped: Location[] = [];
    let previousCanonicalPath: string | null = null;

    for (const { canonicalPath, location } of sorted) {
      const previous = deduped.at(-1);
      if (
        previous &&
        previousCanonicalPath === canonicalPath &&
        this.isDuplicateLocation(previous, location)
      ) {
        deduped[deduped.length - 1] = this.preferLocation(previous, location);
        continue;
      }

      deduped.push(location);
      previousCanonicalPath = canonicalPath;
    }

    return deduped;
  }

  private async getClassReferenceInfo(
    folderController: FolderController,
    importUri: Uri,
    className: string,
  ): Promise<{ classNames: Set<string>; declarationLocation: Location | null }> {
    const classNames = new Set<string>([className]);
    const types = await folderController.getTypes(importUri);
    if (!types) {
      return { classNames, declarationLocation: null };
    }

    const extracted = types.classes.get(className);
    if (!extracted) {
      return { classNames, declarationLocation: null };
    }

    const aliases = types.aliases.get(className);
    if (aliases) {
      for (const alias of aliases) {
        classNames.add(alias);
      }
    }

    const [{ start, source }] = extracted;
    const target = Uri.joinPath(Utils.dirname(importUri), source);

    return {
      classNames,
      declarationLocation: new Location(target, new Position(start.line - 1, start.column)),
    };
  }

  public async provideReferences(
    document: TextDocument,
    position: Position,
    context: ReferenceContext,
    token: CancellationToken,
  ): Promise<Location[]> {
    const folderController = this.#workspaceController.folderController(document.uri);
    if (folderController) {
      const tse = new TSExtractor(document, position);

      const classInfo = await tse.getClassInfo();
      if (classInfo) {
        const { importUri, className, accessorType } = classInfo;
        const locations: Location[] = [];
        const { classNames, declarationLocation } = await this.getClassReferenceInfo(
          folderController,
          importUri,
          className,
        );

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
              const extractor = new TSExtractor(await workspace.openTextDocument(file));
              for (const usage of await extractor.findClassUsages(importUri, classNames)) {
                if (accessorType === 'element' && usage.accessorType === accessorType) {
                  continue;
                }

                locations.push(new Location(file, usage.range));
              }
              break;
            }
          }
        }

        const normalizedLocations = this.normalizeLocations(locations);

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
