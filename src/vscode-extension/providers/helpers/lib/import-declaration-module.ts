import { isImportDeclaration, isStringLiteral, type Node } from 'typescript';

export function importDeclarationModule(node: Node): string | null {
  let current: Node | undefined = node;

  while (current) {
    if (isImportDeclaration(current) && isStringLiteral(current.moduleSpecifier)) {
      return current.moduleSpecifier.text;
    }

    current = current.parent;
  }

  return null;
}
