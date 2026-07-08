import { isStringLiteralLike, type SourceFile } from 'typescript';

import { type AccessExpressionLike, isPropertyAccessExpressionLike } from './expression.ts';

type PropertyNameRange = {
  start: number;
  end: number;
};

export function propertyNameRange(
  sourceFile: SourceFile,
  access: AccessExpressionLike,
): PropertyNameRange | null {
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
