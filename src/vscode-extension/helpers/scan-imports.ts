import {
  createSourceFile,
  isCallExpression,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isStringLiteral,
  type Node,
  ScriptTarget,
  SyntaxKind,
} from 'typescript';
import { type TextDocument, type Uri } from 'vscode';
import { Utils } from 'vscode-uri';

import { fileOperation, type Logger } from '../../common/index.ts';

export function* scanImports(code: TextDocument, logger: Logger): Generator<Uri> {
  try {
    const sourceFile = createSourceFile(code.uri.fsPath, code.getText(), ScriptTarget.Latest, true);
    yield* visit(code.uri, sourceFile);
  } catch (error) {
    logger.error(fileOperation(code.uri, 'error', error));
    throw error;
  }
}

function* visit(file: Uri, node: Node): Generator<Uri> {
  if (
    // import ... from '...'
    (isImportDeclaration(node) ||
      // export ... from '...'
      isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    isStringLiteral(node.moduleSpecifier)
  ) {
    const imported = resolveImport(node.moduleSpecifier.text, file);
    if (imported) {
      yield imported;
    }
  }

  // require('...') or import('...')
  else if (isCallExpression(node)) {
    const expr = node.expression;
    if ((isIdentifier(expr) && expr.text === 'require') || expr.kind === SyntaxKind.ImportKeyword) {
      const [arg] = node.arguments;
      if (arg && isStringLiteral(arg)) {
        const imported = resolveImport(arg.text, file);
        if (imported) {
          yield imported;
        }
      }
    }
  }

  for (const child of node.getChildren()) {
    yield* visit(file, child);
  }
}

function resolveImport(importSpec: string, file: Uri): Uri | undefined {
  // Local imports
  if (importSpec.startsWith('node:')) {
    return undefined;
  }

  if (importSpec.startsWith('.') || importSpec.startsWith('/')) {
    return Utils.resolvePath(Utils.dirname(file), importSpec);
  }

  return undefined;
}
