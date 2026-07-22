import { type Expression, isCallExpression, isIdentifier, isStringLiteralLike } from 'typescript';

import { unwrapExpression } from './unwrap-expression.ts';

export function requireCallModule(initializer: Expression | undefined): string | null {
  if (initializer) {
    const expression = unwrapExpression(initializer);
    if (isCallExpression(expression)) {
      const callee = unwrapExpression(expression.expression);
      const [argument] = expression.arguments;

      if (isIdentifier(callee) && callee.text === 'require') {
        return argument && isStringLiteralLike(argument) ? argument.text : null;
      }
    }
  }
  return null;
}
