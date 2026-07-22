import {
  type Expression,
  isAsExpression,
  isNonNullExpression,
  isParenthesizedExpression,
  isSatisfiesExpression,
  isTypeAssertionExpression,
} from 'typescript';

export function unwrapExpression(expression: Expression): Expression {
  let current = expression;

  while (
    isAsExpression(current) ||
    isParenthesizedExpression(current) ||
    isSatisfiesExpression(current) ||
    isTypeAssertionExpression(current) ||
    isNonNullExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}
