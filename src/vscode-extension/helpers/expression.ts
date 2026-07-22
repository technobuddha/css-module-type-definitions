import {
  type ElementAccessChain,
  type ElementAccessExpression,
  isElementAccessChain,
  isElementAccessExpression,
  isPropertyAccessChain,
  isPropertyAccessExpression,
  type Node,
  type PropertyAccessChain,
  type PropertyAccessExpression,
} from 'typescript';

export type ElementAccessExpressionLike = ElementAccessExpression | ElementAccessChain;
export type PropertyAccessExpressionLike = PropertyAccessExpression | PropertyAccessChain;
export type AccessExpressionLike = PropertyAccessExpressionLike | ElementAccessExpressionLike;

export function isElementAccessExpressionLike(node: Node): node is ElementAccessExpressionLike {
  return isElementAccessExpression(node) || isElementAccessChain(node);
}

export function isPropertyAccessExpressionLike(node: Node): node is PropertyAccessExpressionLike {
  return isPropertyAccessExpression(node) || isPropertyAccessChain(node);
}

export function isAccessExpressionLike(node: Node): node is AccessExpressionLike {
  return isPropertyAccessExpressionLike(node) || isElementAccessExpressionLike(node);
}
