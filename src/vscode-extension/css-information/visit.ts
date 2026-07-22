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
  const { bindingNames, localNames, sourceFile } = state;

  if (isPropertyAccessExpressionLike(node)) {
    const expression = unwrapExpression(node.expression);
    if (
      isIdentifier(expression) &&
      bindingNames.has(expression.text) &&
      localNames.has(node.name.text)
    ) {
      addRange(node, node.name.getStart(sourceFile), node.name.getEnd(), 'property', state);
    }
  }

  if (isElementAccessExpressionLike(node)) {
    const expression = unwrapExpression(node.expression);
    const argument = node.argumentExpression;

    if (
      isIdentifier(expression) &&
      bindingNames.has(expression.text) &&
      argument &&
      isStringLiteralLike(argument) &&
      localNames.has(argument.text)
    ) {
      addRange(node, argument.getStart(sourceFile), argument.getEnd(), 'element', state);
    }
  }

  forEachChild(node, (child) => visit(child, state));
}
