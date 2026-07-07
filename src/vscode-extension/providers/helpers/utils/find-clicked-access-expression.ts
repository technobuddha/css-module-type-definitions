import { type Node, type SourceFile } from 'typescript';

import { type AccessExpressionLike, isAccessExpressionLike } from './expression.ts';
import { getPropertyNameRange } from './get-property-name-range.ts';
import { isWithin } from './is-within.ts';

export function findClickedAccessExpression(
  sourceFile: SourceFile,
  node: Node,
  position: number,
): AccessExpressionLike | null {
  let current: Node | undefined = node;

  while (current) {
    if (isAccessExpressionLike(current)) {
      const range = getPropertyNameRange(sourceFile, current);
      if (range && isWithin(position, range.start, range.end)) {
        return current;
      }
    }

    current = current.parent;
  }

  return null;
}
