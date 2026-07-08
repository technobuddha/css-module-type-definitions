import { forEachChild, type Node, type SourceFile } from 'typescript';

export function findDeepestNodeAtPosition(sourceFile: SourceFile, position: number): Node | null {
  let result: Node | null = null;

  function visit(node: Node): void {
    if (position < node.getFullStart() || position >= node.getEnd()) {
      return;
    }

    result = node;
    forEachChild(node, visit);
  }

  visit(sourceFile);
  return result;
}
