import { toError } from '@technobuddha/library';
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

/**
 * Scans a TypeScript/JavaScript file and returns a list of resolved module paths,
 * including import and re-export module specifiers, with tsconfig path mapping resolution.
 * @param filePath - Path to the file to scan
 * @param fileContent - Optional file content (if already loaded)
 * @returns Array of resolved module paths
 */
export function scanImports(code: TextDocument): Uri[] {
  try {
    const sourceFile = createSourceFile(code.uri.fsPath, code.getText(), ScriptTarget.Latest, true);
    const imports: Uri[] = [...visit(code.uri, sourceFile)];
    return imports;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`Error scanning imports for ${code.uri.fsPath}:`, toError(e));
    throw e;
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
