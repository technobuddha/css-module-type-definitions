import {
  isExternalModuleReference,
  isImportEqualsDeclaration,
  isStringLiteral,
  type Node,
} from 'typescript';

export function importEqualsModule(node: Node): string | null {
  if (
    isImportEqualsDeclaration(node) &&
    isExternalModuleReference(node.moduleReference) &&
    node.moduleReference.expression &&
    isStringLiteral(node.moduleReference.expression)
  ) {
    return node.moduleReference.expression.text;
  }

  return null;
}
