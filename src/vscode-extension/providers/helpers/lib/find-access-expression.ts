import { type Node, type SourceFile } from 'typescript';

import { type AccessExpressionLike, isAccessExpressionLike } from './expression.ts';
import { isWithin } from './is-within.ts';
import { propertyNameRange } from './property-name-range.ts';

export function findAccessExpression(
  sourceFile: SourceFile,
  node: Node,
  position: number,
): AccessExpressionLike | null {
  let current: Node | undefined = node;

  while (current) {
    if (isAccessExpressionLike(current)) {
      const range = propertyNameRange(sourceFile, current);
      if (range && isWithin(position, range.start, range.end)) {
        return current;
      }
    }

    current = current.parent;
  }

  return null;
}
