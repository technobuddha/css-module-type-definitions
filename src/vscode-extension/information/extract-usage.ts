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

import {
  createRange,
  getSourceFile,
  isElementAccessExpressionLike,
  isPropertyAccessExpressionLike,
  type ReadonlyUriMap,
  resolveImportPath,
  unwrapExpression,
  UriMap,
} from '../helpers/index.ts';

export type Usage = {
  readonly localName: string;
  readonly range: Range;
  readonly accessorType: 'property' | 'element';
};

type ImportBinding = {
  importModule: string;
  variableName?: string;
};

export async function extractUsage(document: TextDocument, importUri: Uri): Promise<Usage[]>;
export async function extractUsage(document: TextDocument): Promise<ReadonlyUriMap<Usage[]>>;
export async function extractUsage(
  document: TextDocument,
  importUri?: Uri,
): Promise<Usage[] | ReadonlyUriMap<Usage[]>> {
  const parser = await UsageParser.create(document);

  if (importUri) {
    return parser.usages.get(importUri) ?? [];
  }

  return parser.usages;
}

class UsageParser {
  public static async create(document: TextDocument): Promise<UsageParser> {
    const sourceFile = getSourceFile(document);
    const parser = new UsageParser(sourceFile);
    const importBindings: UriMap<Set<string>> = new UriMap();

    for (const binding of this.extractImportBindings(sourceFile)) {
      if (binding.variableName) {
        const resolved = await resolveImportPath(document.uri.fsPath, binding.importModule);
        if (resolved) {
          importBindings.getOrInsertComputed(resolved, () => new Set()).add(binding.variableName);
        }
      }
    }

    for (const [importUri, bindings] of importBindings) {
      parser.extractUsages(sourceFile, bindings, importUri);
    }

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
          yield {
            importModule: argument.text,
          };
        }
      }

      if (isCallExpression(expression) && expression.expression.kind === SyntaxKind.ImportKeyword) {
        const [argument] = expression.arguments;
        if (argument && isStringLiteral(argument)) {
          yield {
            importModule: argument.text,
          };
        }
      }

      if (
        isAwaitExpression(expression) &&
        isCallExpression(expression.expression) &&
        expression.expression.expression.kind === SyntaxKind.ImportKeyword
      ) {
        const [argument] = expression.expression.arguments;
        if (argument && isStringLiteral(argument)) {
          yield {
            importModule: argument.text,
          };
        }
      }
    }

    if (
      isImportDeclaration(node) &&
      isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text
    ) {
      if (!node.importClause) {
        yield {
          importModule: node.moduleSpecifier.text,
        };
        return;
      }

      if (node.importClause.name) {
        yield {
          importModule: node.moduleSpecifier.text,
          variableName: node.importClause.name.text,
        };
      }

      if (node.importClause.namedBindings && isNamespaceImport(node.importClause.namedBindings)) {
        yield {
          importModule: node.moduleSpecifier.text,
          variableName: node.importClause.namedBindings.name.text,
        };
      }

      if (node.importClause.namedBindings && isNamedImports(node.importClause.namedBindings)) {
        for (const element of node.importClause.namedBindings.elements) {
          if (element.propertyName?.text === 'default' || element.name.text === 'default') {
            yield {
              importModule: node.moduleSpecifier.text,
              variableName: element.name.text,
            };
          }
        }
      }
    }

    if (isImportEqualsDeclaration(node) && isExternalModuleReference(node.moduleReference)) {
      const moduleExpression = node.moduleReference.expression;
      if (moduleExpression && isStringLiteral(moduleExpression)) {
        yield {
          importModule: moduleExpression.text,
          variableName: node.name.text,
        };
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
        yield {
          importModule: argument.text,
          variableName: node.name.text,
        };
      }
    }

    for (const child of node.getChildren()) {
      yield* this.extractImportBindings(child);
    }
  }

  private readonly seenUsages: Set<string> = new Set();
  private readonly sourceFile: SourceFile;
  public readonly usages: UriMap<Usage[]> = new UriMap();

  private constructor(sourceFile: SourceFile) {
    this.sourceFile = sourceFile;
  }

  protected extractUsages(node: Node, bindings: Set<string>, importUri: Uri): void {
    if (isPropertyAccessExpressionLike(node)) {
      const expression = unwrapExpression(node.expression);
      if (isIdentifier(expression) && bindings.has(expression.text)) {
        this.addRange(node, node.name, 'property', importUri);
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
        this.addRange(node, argument, 'element', importUri);
      }
    }

    forEachChild(node, (child) => this.extractUsages(child, bindings, importUri));
  }

  protected addRange(
    node: Node,
    target: MemberName | StringLiteralLike,
    accessorType: Usage['accessorType'],
    importUri: Uri,
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
      .getOrInsertComputed(importUri, (): Usage[] => [])
      .push({ localName, range, accessorType });
  }
}
