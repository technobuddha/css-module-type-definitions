import {
  isCallExpression,
  isExternalModuleReference,
  isIdentifier,
  isImportDeclaration,
  isImportEqualsDeclaration,
  isNamedImports,
  isNamespaceImport,
  isStringLiteral,
  isVariableDeclaration,
  type Node,
  type SourceFile,
} from 'typescript';

type ImportBinding = {
  importModule: string;
  variableName: string;
};

export function collectImportBindings(sourceFile: SourceFile): ImportBinding[] {
  return visit(sourceFile).toArray();
}

function* visit(node: Node): Generator<ImportBinding> {
  if (
    isImportDeclaration(node) &&
    isStringLiteral(node.moduleSpecifier) &&
    node.moduleSpecifier.text &&
    node.importClause
  ) {
    if (node.importClause.name) {
      yield {
        importModule: node.moduleSpecifier.text,
        variableName: node.importClause.name.text,
      };
    }

    if (node.importClause.namedBindings && isNamespaceImport(node.importClause.namedBindings)) {
      yield {
        importModule: node.moduleSpecifier.text,
        variableName: node.importClause.namedBindings.name.text,
      };
    }

    if (node.importClause.namedBindings && isNamedImports(node.importClause.namedBindings)) {
      for (const element of node.importClause.namedBindings.elements) {
        if (element.propertyName?.text === 'default' || element.name.text === 'default') {
          yield {
            importModule: node.moduleSpecifier.text,
            variableName: element.name.text,
          };
        }
      }
    }
  }

  if (isImportEqualsDeclaration(node) && isExternalModuleReference(node.moduleReference)) {
    const moduleExpression = node.moduleReference.expression;
    if (moduleExpression && isStringLiteral(moduleExpression)) {
      yield {
        importModule: moduleExpression.text,
        variableName: node.name.text,
      };
    }
  }

  if (
    isVariableDeclaration(node) &&
    isIdentifier(node.name) &&
    node.initializer &&
    isCallExpression(node.initializer) &&
    isIdentifier(node.initializer.expression) &&
    node.initializer.expression.text === 'require'
  ) {
    const [argument] = node.initializer.arguments;
    if (argument && isStringLiteral(argument)) {
      yield {
        importModule: argument.text,
        variableName: node.name.text,
      };
    }
  }

  for (const child of node.getChildren()) {
    yield* visit(child);
  }
}
