import {
  forEachChild,
  isAwaitExpression,
  isCallExpression,
  isExpressionStatement,
  isExternalModuleReference,
  isIdentifier,
  isImportDeclaration,
  isImportEqualsDeclaration,
  isNamedImports,
  isNamespaceImport,
  isStringLiteral,
  isStringLiteralLike,
  isVariableDeclaration,
  type MemberName,
  type Node,
  type SourceFile,
  type StringLiteralLike,
  SyntaxKind,
} from 'typescript';
import { type Range, type TextDocument, type Uri } from 'vscode';

import { isCss } from '../../common/index.ts';

import {
  createRange,
  getSourceFile,
  isElementAccessExpressionLike,
  isPropertyAccessExpressionLike,
  type ReadonlyUriMap,
  type ReadonlyUriSet,
  resolveImportPath,
  unwrapExpression,
  UriMap,
  UriSet,
} from '../helpers/index.ts';

export type Usage = {
  readonly localName: string;
  readonly range: Range;
  readonly accessorType: 'property' | 'element';
};

type ImportBinding = {
  readonly importModule: string;
  readonly variableName?: string;
};

type Return = {
  readonly usages: ReadonlyUriMap<Usage[]>;
  readonly unbound: ReadonlyUriSet;
};

export async function extractUsage(document: TextDocument, importUri: Uri): Promise<Usage[]>;
export async function extractUsage(document: TextDocument): Promise<Return>;
export async function extractUsage(
  document: TextDocument,
  importUri?: Uri,
): Promise<Usage[] | Return> {
  const parser = await UsageParser.create(document);

  if (importUri) {
    return parser.usages.get(importUri) ?? [];
  }

  return {
    usages: parser.usages,
    unbound: parser.unbound,
  };
}

class UsageParser {
  public static async create(document: TextDocument): Promise<UsageParser> {
    const sourceFile = getSourceFile(document);
    const moduleBindings: UriMap<Set<string>> = new UriMap();
    const unboundModules: UriSet = new UriSet();

    for (const binding of this.extractImportBindings(sourceFile)) {
      const moduleUri = await resolveImportPath(document.uri.fsPath, binding.importModule);
      if (moduleUri) {
        if (binding.variableName) {
          moduleBindings.getOrInsertComputed(moduleUri, () => new Set()).add(binding.variableName);
        } else {
          unboundModules.add(moduleUri);
        }
      }
    }

    const parser = new UsageParser(sourceFile, moduleBindings, unboundModules);

    return parser;
  }

  private static *extractImportBindings(node: Node): Generator<ImportBinding> {
    if (isExpressionStatement(node)) {
      const { expression } = node;

      if (
        isCallExpression(expression) &&
        isIdentifier(expression.expression) &&
        expression.expression.text === 'require'
      ) {
        const [argument] = expression.arguments;
        if (argument && isStringLiteral(argument)) {
          if (isCss(argument.text)) {
            yield {
              importModule: argument.text,
            };
          }
        }
      }

      if (isCallExpression(expression) && expression.expression.kind === SyntaxKind.ImportKeyword) {
        const [argument] = expression.arguments;
        if (argument && isStringLiteral(argument)) {
          if (isCss(argument.text)) {
            yield {
              importModule: argument.text,
            };
          }
        }
      }

      if (
        isAwaitExpression(expression) &&
        isCallExpression(expression.expression) &&
        expression.expression.expression.kind === SyntaxKind.ImportKeyword
      ) {
        const [argument] = expression.expression.arguments;
        if (argument && isStringLiteral(argument)) {
          if (isCss(argument.text)) {
            yield {
              importModule: argument.text,
            };
          }
        }
      }
    }

    if (
      isImportDeclaration(node) &&
      isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text
    ) {
      if (!node.importClause) {
        if (isCss(node.moduleSpecifier.text)) {
          yield {
            importModule: node.moduleSpecifier.text,
          };
        }
        return;
      }

      if (node.importClause.name) {
        if (isCss(node.moduleSpecifier.text)) {
          yield {
            importModule: node.moduleSpecifier.text,
            variableName: node.importClause.name.text,
          };
        }
      }

      if (node.importClause.namedBindings && isNamespaceImport(node.importClause.namedBindings)) {
        if (isCss(node.moduleSpecifier.text)) {
          yield {
            importModule: node.moduleSpecifier.text,
            variableName: node.importClause.namedBindings.name.text,
          };
        }
      }

      if (node.importClause.namedBindings && isNamedImports(node.importClause.namedBindings)) {
        for (const element of node.importClause.namedBindings.elements) {
          if (element.propertyName?.text === 'default' || element.name.text === 'default') {
            if (isCss(node.moduleSpecifier.text)) {
              yield {
                importModule: node.moduleSpecifier.text,
                variableName: element.name.text,
              };
            }
          }
        }
      }
    }

    if (isImportEqualsDeclaration(node) && isExternalModuleReference(node.moduleReference)) {
      const moduleExpression = node.moduleReference.expression;
      if (moduleExpression && isStringLiteral(moduleExpression)) {
        if (isCss(moduleExpression.text)) {
          yield {
            importModule: moduleExpression.text,
            variableName: node.name.text,
          };
        }
      }
    }

    if (
      isVariableDeclaration(node) &&
      isIdentifier(node.name) &&
      node.initializer &&
      isCallExpression(node.initializer) &&
      isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === 'require'
    ) {
      const [argument] = node.initializer.arguments;
      if (argument && isStringLiteral(argument)) {
        if (isCss(argument.text)) {
          yield {
            importModule: argument.text,
            variableName: node.name.text,
          };
        }
      }
    }

    for (const child of node.getChildren()) {
      yield* this.extractImportBindings(child);
    }
  }

  private readonly seenUsages: Set<string> = new Set();
  private readonly sourceFile: SourceFile;
  public readonly unbound: ReadonlyUriSet;
  public readonly usages: UriMap<Usage[]> = new UriMap();

  private constructor(
    sourceFile: SourceFile,
    moduleBindings: ReadonlyUriMap<Set<string>>,
    unbound: ReadonlyUriSet,
  ) {
    this.sourceFile = sourceFile;
    this.unbound = unbound;

    for (const [moduleUri, bindings] of moduleBindings) {
      this.findUsages(sourceFile, bindings, moduleUri);
    }
  }

  protected findUsages(node: Node, bindings: Set<string>, moduleUri: Uri): void {
    if (isPropertyAccessExpressionLike(node)) {
      const expression = unwrapExpression(node.expression);
      if (isIdentifier(expression) && bindings.has(expression.text)) {
        this.addRange(node, node.name, 'property', moduleUri);
      }
    }

    if (isElementAccessExpressionLike(node)) {
      const expression = unwrapExpression(node.expression);
      const argument = node.argumentExpression;

      if (
        isIdentifier(expression) &&
        bindings.has(expression.text) &&
        argument &&
        isStringLiteralLike(argument)
      ) {
        this.addRange(node, argument, 'element', moduleUri);
      }
    }

    forEachChild(node, (child) => this.findUsages(child, bindings, moduleUri));
  }

  protected addRange(
    node: Node,
    target: MemberName | StringLiteralLike,
    accessorType: Usage['accessorType'],
    moduleUri: Uri,
  ): void {
    const { seenUsages, usages, sourceFile } = this;

    const start = target.getStart(sourceFile);
    const end = target.getEnd();
    const localName = target.text;

    const usageKey = [node.getStart(sourceFile), node.getEnd()].join(':');
    if (seenUsages.has(usageKey)) {
      return;
    }

    seenUsages.add(usageKey);

    const range = createRange(sourceFile, start, end);
    usages
      .getOrInsertComputed(moduleUri, (): Usage[] => [])
      .push({ localName, range, accessorType });
  }
}
