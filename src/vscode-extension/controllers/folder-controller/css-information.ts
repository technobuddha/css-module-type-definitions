import {
  forEachChild,
  isIdentifier,
  isStringLiteralLike,
  type Node,
  type SourceFile,
} from 'typescript';
import { Location, Position, Range, type TextDocument, Uri } from 'vscode';
import { Utils } from 'vscode-uri';

import { type CssInfo, type CssLocation } from '../../../css-library/index.ts';

import { createRange } from '../../helpers/create-range.ts';
import {
  isElementAccessExpressionLike,
  isPropertyAccessExpressionLike,
} from '../../helpers/expression.ts';
import { getSourceFile } from '../../helpers/get-source-file.ts';
import { importBindingNames } from '../../helpers/import-binding-names.ts';
import { unwrapExpression } from '../../helpers/unwrap-expression.ts';

type ClassUsage = {
  range: Range;
  accessorType: 'property' | 'element';
};

export class CssInformation implements CssInfo {
  public files: Record<string, string>;
  public locals: Map<string, CssLocation[]>;
  public includedFiles: Set<string>;
  public classLocal: Map<string, Set<string>>;
  public localClass: Map<string, Set<string>>;

  public constructor({ files, locals, includedFiles, classLocal, localClass }: CssInfo) {
    this.files = files;
    this.locals = locals;
    this.includedFiles = includedFiles;
    this.classLocal = classLocal;
    this.localClass = localClass;
  }

  public cssLocations(localName: string, importUri: Uri): ReadonlyMap<string, Location[]> | null {
    const classes = this.localClass.get(localName);
    if (classes) {
      const result = new Map<string, Location[]>();

      for (const className of classes) {
        const locations = this.locals.get(className);
        if (locations) {
          result.set(
            className,
            locations.map(
              ({
                location: {
                  source,
                  range: { start, end },
                },
              }) =>
                new Location(
                  Uri.joinPath(Utils.dirname(importUri), source),
                  new Range(
                    new Position(start.line, start.column),
                    new Position(end.line, end.column),
                  ),
                ),
            ),
          );
        }
      }
      return result;
    }

    return null;
  }

  public async localUsages(
    document: TextDocument,
    importUri: Uri,
    localNames: Set<string>,
  ): Promise<ClassUsage[]> {
    const usages: ClassUsage[] = [];

    if (localNames) {
      const sourceFile = getSourceFile(document);
      const seenUsages = new Set<string>();
      const bindingNames = await importBindingNames(document, sourceFile, importUri);
      if (bindingNames.size === 0) {
        return [];
      }

      visit(sourceFile, { bindingNames, localNames, seenUsages, usages, sourceFile });
    }
    return usages;
  }

  public localNames(classNames: Iterable<string>): Set<string> {
    return new Set(
      Array.from(classNames).flatMap((className) =>
        Array.from(this.classLocal.get(className) ?? []),
      ),
    );
  }
}

type State = {
  bindingNames: Set<string>;
  localNames: Set<string>;
  seenUsages: Set<string>;
  usages: ClassUsage[];
  sourceFile: SourceFile;
};

function addRange(
  node: Node,
  start: number,
  end: number,
  accessorType: ClassUsage['accessorType'],
  state: State,
): void {
  const { seenUsages, usages, sourceFile } = state;
  const usageKey = [node.getStart(sourceFile), node.getEnd()].join(':');
  if (seenUsages.has(usageKey)) {
    return;
  }

  seenUsages.add(usageKey);

  const range = createRange(sourceFile, start, end);
  usages.push({ range, accessorType });
}

function visit(node: Node, state: State): void {
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
