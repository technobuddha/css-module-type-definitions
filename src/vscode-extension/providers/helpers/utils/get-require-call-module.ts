import { type Expression, isCallExpression, isIdentifier, isStringLiteralLike } from 'typescript';

import { unwrapExpression } from './unwrap-expression.ts';

export function getRequireCallModule(initializer: Expression | undefined): string | null {
  if (!initializer) {
    return null;
  }

  const expression = unwrapExpression(initializer);
  if (!isCallExpression(expression)) {
    return null;
  }

  const callee = unwrapExpression(expression.expression);
  const [argument] = expression.arguments;

  if (!isIdentifier(callee) || callee.text !== 'require') {
    return null;
  }

  return argument && isStringLiteralLike(argument) ? argument.text : null;
}
