import { forEachChild, isIdentifier, isStringLiteralLike, type Node } from 'typescript';
import { type Range, type TextDocument, type Uri } from 'vscode';

import { createRange } from './lib/create-range.ts';
import { isElementAccessExpressionLike, isPropertyAccessExpressionLike } from './lib/expression.ts';
import { getSourceFile } from './lib/get-source-file.ts';
import { importBindingNames } from './lib/import-binding-names.ts';
import { unwrapExpression } from './lib/unwrap-expression.ts';

type ClassUsage = {
  range: Range;
  accessorType: 'property' | 'element';
};

export async function findClassUsages(
  document: TextDocument,
  importUri: Uri,
  classNames: ReadonlySet<string>,
): Promise<ClassUsage[]> {
  const sourceFile = getSourceFile(document);

  const bindingNames = await importBindingNames(document, sourceFile, importUri);
  if (bindingNames.size === 0) {
    return [];
  }

  const usages: ClassUsage[] = [];
  const seenUsages = new Set<string>();

  const addRange = (
    node: Node,
    start: number,
    end: number,
    accessorType: ClassUsage['accessorType'],
  ): void => {
    const usageKey = [node.getStart(sourceFile), node.getEnd()].join(':');
    if (seenUsages.has(usageKey)) {
      return;
    }

    seenUsages.add(usageKey);

    const range = createRange(sourceFile, start, end);
    usages.push({ range, accessorType });
  };

  const visit = (node: Node): void => {
    if (isPropertyAccessExpressionLike(node)) {
      const expression = unwrapExpression(node.expression);
      if (
        isIdentifier(expression) &&
        bindingNames.has(expression.text) &&
        classNames.has(node.name.text)
      ) {
        addRange(node, node.name.getStart(sourceFile), node.name.getEnd(), 'property');
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
        classNames.has(argument.text)
      ) {
        addRange(node, argument.getStart(sourceFile), argument.getEnd(), 'element');
      }
    }

    forEachChild(node, visit);
  };

  visit(sourceFile);
  return usages;
}
