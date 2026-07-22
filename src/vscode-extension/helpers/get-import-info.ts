import { isIdentifier } from 'typescript';
import { type Position, type TextDocument, type Uri } from 'vscode';

import { findDeepestNodeAtPosition } from './find-deepest-node-at-position.ts';
import { getSourceFile } from './get-source-file.ts';
import { getTypeChecker } from './get-type-checker.ts';
import { importModuleFromDeclaration } from './import-module-from-declaration.ts';
import { resolveImportPath } from './resolve-import-path.ts';
import { variableNameBeforeAccessor } from './variable-name-before-accessor.ts';

type ImportInfo = {
  importUri: Uri;
  variableName: string;
};

export async function getImportInfo(
  document: TextDocument,
  position?: Position,
): Promise<ImportInfo | null> {
  if (position) {
    const sourceFile = getSourceFile(document);
    const typeChecker = getTypeChecker(document, sourceFile);

    const offset = sourceFile.getPositionOfLineAndCharacter(position.line, position.character);

    const variable = variableNameBeforeAccessor(document, offset);
    if (!variable) {
      return null;
    }

    const { variableName, identifierOffset } = variable;
    const node = findDeepestNodeAtPosition(sourceFile, identifierOffset);

    if (!node || !isIdentifier(node) || node.text !== variableName) {
      return null;
    }

    const symbol = typeChecker.getSymbolAtLocation(node);
    if (!symbol?.declarations) {
      return null;
    }

    for (const declaration of symbol.declarations) {
      const importModule = importModuleFromDeclaration(declaration);

      if (importModule) {
        const importUri = await resolveImportPath(document.uri.fsPath, importModule);

        if (importUri) {
          return { importUri, variableName };
        }
      }
    }
  }

  return null;
}
