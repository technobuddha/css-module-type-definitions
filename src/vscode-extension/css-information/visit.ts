import { type Node } from 'typescript';
import { forEachChild, isIdentifier, isStringLiteralLike } from 'typescript';

import {
  isElementAccessExpressionLike,
  isPropertyAccessExpressionLike,
  unwrapExpression,
} from '../helpers/index.ts';

import { addRange } from './add-range.ts';
import { type State } from './state.ts';

export function visit(node: Node, state: State): void {
  const { bindingNames } = state;

  if (isPropertyAccessExpressionLike(node)) {
    const expression = unwrapExpression(node.expression);
    if (isIdentifier(expression) && bindingNames.has(expression.text)) {
      addRange(node, node.name, 'property', state);
    }
  }

  if (isElementAccessExpressionLike(node)) {
    const expression = unwrapExpression(node.expression);
    const argument = node.argumentExpression;

    if (
      isIdentifier(expression) &&
      bindingNames.has(expression.text) &&
      argument &&
      isStringLiteralLike(argument)
    ) {
      addRange(node, argument, 'element', state);
    }
  }

  forEachChild(node, (child) => visit(child, state));
}
