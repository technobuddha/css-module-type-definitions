import { isIdentifier, isStringLiteralLike } from 'typescript';
import { type Position, type TextDocument, type Uri } from 'vscode';

import { isPropertyAccessExpressionLike } from './lib/expression.ts';
import { findAccessExpression } from './lib/find-access-expression.ts';
import { findDeepestNodeAtPosition } from './lib/find-deepest-node-at-position.ts';
import { getSourceFile } from './lib/get-source-file.ts';
import { getTypeChecker } from './lib/get-type-checker.ts';
import { importModuleFromDeclaration } from './lib/import-module-from-declaration.ts';
import { resolveImportPath } from './lib/resolve-import-path.ts';
import { unwrapExpression } from './lib/unwrap-expression.ts';

type LocalInfo = {
  importUri: Uri;
  localName: string;
  variableName: string;
  accessorType: 'property' | 'element';
};

export async function getLocalInfo(
  document: TextDocument,
  position?: Position,
): Promise<LocalInfo | null> {
  if (position) {
    const sourceFile = getSourceFile(document);
    const typeChecker = getTypeChecker(document, sourceFile);

    const startPosition = sourceFile.getPositionOfLineAndCharacter(
      position.line,
      position.character,
    );
    const finishPosition = startPosition > 0 ? startPosition - 1 : startPosition;

    for (let position = startPosition; position >= finishPosition; position--) {
      const node = findDeepestNodeAtPosition(sourceFile, position);
      if (node) {
        const access = findAccessExpression(sourceFile, node, position);

        if (access) {
          const expression = unwrapExpression(access.expression);

          if (isIdentifier(expression)) {
            const variableName = expression.text;

            const localName =
              isPropertyAccessExpressionLike(access) ? access.name.text
              : access.argumentExpression && isStringLiteralLike(access.argumentExpression) ?
                access.argumentExpression.text
              : null;
            const accessorType: LocalInfo['accessorType'] =
              isPropertyAccessExpressionLike(access) ? 'property' : 'element';

            if (localName) {
              const symbol = typeChecker.getSymbolAtLocation(expression);
              if (symbol?.declarations) {
                for (const declaration of symbol.declarations) {
                  const importModule = importModuleFromDeclaration(declaration);

                  if (importModule) {
                    const importUri = await resolveImportPath(document.uri.fsPath, importModule);

                    if (importUri) {
                      return { importUri, localName, variableName, accessorType };
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return null;
}
