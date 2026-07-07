import { isStringLiteralLike, type SourceFile } from 'typescript';

import { type AccessExpressionLike, isPropertyAccessExpressionLike } from './expression.ts';

export function getPropertyNameRange(
  sourceFile: SourceFile,
  access: AccessExpressionLike,
): { start: number; end: number } | null {
  if (isPropertyAccessExpressionLike(access)) {
    return {
      start: access.name.getStart(sourceFile),
      end: access.name.getEnd(),
    };
  }

  const { argumentExpression } = access;
  if (!argumentExpression || !isStringLiteralLike(argumentExpression)) {
    return null;
  }

  return {
    start: argumentExpression.getStart(sourceFile),
    end: argumentExpression.getEnd(),
  };
}
