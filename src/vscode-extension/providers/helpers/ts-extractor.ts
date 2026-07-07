import { isJsVariable } from '@technobuddha/library';
import {
  type CompilerOptions,
  createCompilerHost,
  createProgram,
  createSourceFile,
  forEachChild,
  isCallExpression,
  isExternalModuleReference,
  isIdentifier,
  isImportDeclaration,
  isImportEqualsDeclaration,
  isNamedImports,
  isNamespaceImport,
  isStringLiteral,
  isStringLiteralLike,
  isVariableDeclaration,
  JsxEmit,
  ModuleKind,
  type Node,
  ScriptTarget,
  type SourceFile,
  type TypeChecker,
} from 'typescript';
import { type Position, type Range, type TextDocument, type Uri } from 'vscode';

import { createRange } from './utils/create-range.ts';
import {
  isElementAccessExpressionLike,
  isPropertyAccessExpressionLike,
} from './utils/expression.ts';
import { findClickedAccessExpression } from './utils/find-clicked-access-expression.ts';
import { findDeepestNodeAtPosition } from './utils/find-deepest-node-at-position.ts';
import { getCodeUnitLength } from './utils/get-code-unit-length.ts';
import { getImportModuleFromDeclaration } from './utils/get-import-module-from-declaration.ts';
import { isExtendedIdentifier } from './utils/is-extended-identifier.ts';
import { resolveImportPath } from './utils/resolve-import-path.ts';
import { scriptKind } from './utils/script-kind.ts';
import { unwrapExpression } from './utils/unwrap-expression.ts';

type ClassInfo = {
  importUri: Uri;
  className: string;
  variableName: string;
  accessorType: 'property' | 'element';
};

type ImportInfo = {
  importUri: Uri;
  variableName: string;
};

type ClassUsage = {
  range: Range;
  accessorType: 'property' | 'element';
};

export class TSExtractor {
  readonly #document: TextDocument;
  readonly #position?: Position;
  #sourceFile?: SourceFile;
  #typeChecker?: TypeChecker;

  public constructor(document: TextDocument, position?: Position) {
    this.#document = document;
    this.#position = position;
  }

  private get sourceFile(): SourceFile {
    if (this.#sourceFile) {
      return this.#sourceFile;
    }

    const filename = this.#document.fileName;

    this.#sourceFile = createSourceFile(
      this.#document.fileName,
      this.#document.getText(),
      ScriptTarget.Latest,
      true,
      scriptKind(filename),
    );

    return this.#sourceFile;
  }

  private get typeChecker(): TypeChecker {
    if (this.#typeChecker) {
      return this.#typeChecker;
    }

    const sourceText = this.#document.getText();

    const compilerOptions: CompilerOptions = {
      allowJs: true,
      checkJs: false,
      jsx: JsxEmit.Preserve,
      module: ModuleKind.ESNext,
      noLib: true,
      noResolve: true,
      skipLibCheck: true,
      target: ScriptTarget.Latest,
    };

    const host = createCompilerHost(compilerOptions, true);

    host.fileExists = (filename): boolean => filename === this.sourceFile.fileName;
    host.readFile = (filename): string | undefined =>
      filename === this.sourceFile.fileName ? sourceText : undefined;
    host.getSourceFile = (filename): SourceFile | undefined =>
      filename === this.sourceFile.fileName ? this.sourceFile : undefined;

    const program = createProgram([this.sourceFile.fileName], compilerOptions, host);

    this.#typeChecker = program.getTypeChecker();
    return this.#typeChecker;
  }

  private collectImportBindings(): { importModule: string; variableName: string }[] {
    const bindings: { importModule: string; variableName: string }[] = [];

    const visit = (node: Node): void => {
      if (
        isImportDeclaration(node) &&
        isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text &&
        node.importClause
      ) {
        if (node.importClause.name) {
          bindings.push({
            importModule: node.moduleSpecifier.text,
            variableName: node.importClause.name.text,
          });
        }

        if (node.importClause.namedBindings && isNamespaceImport(node.importClause.namedBindings)) {
          bindings.push({
            importModule: node.moduleSpecifier.text,
            variableName: node.importClause.namedBindings.name.text,
          });
        }

        if (node.importClause.namedBindings && isNamedImports(node.importClause.namedBindings)) {
          for (const element of node.importClause.namedBindings.elements) {
            if (element.propertyName?.text === 'default' || element.name.text === 'default') {
              bindings.push({
                importModule: node.moduleSpecifier.text,
                variableName: element.name.text,
              });
            }
          }
        }
      }

      if (isImportEqualsDeclaration(node) && isExternalModuleReference(node.moduleReference)) {
        const moduleExpression = node.moduleReference.expression;
        if (moduleExpression && isStringLiteral(moduleExpression)) {
          bindings.push({
            importModule: moduleExpression.text,
            variableName: node.name.text,
          });
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
          bindings.push({
            importModule: argument.text,
            variableName: node.name.text,
          });
        }
      }

      forEachChild(node, visit);
    };

    visit(this.sourceFile);
    return bindings;
  }

  private async getImportBindingNames(importUri: Uri): Promise<Set<string>> {
    const bindingNames = new Set<string>();

    for (const binding of this.collectImportBindings()) {
      const resolved = await resolveImportPath(this.#document.uri.fsPath, binding.importModule);
      if (resolved?.fsPath === importUri.fsPath) {
        bindingNames.add(binding.variableName);
      }
    }

    return bindingNames;
  }

  private getVariableNameBeforeAccessor(
    offset: number,
  ): { variableName: string; identifierOffset: number } | null {
    const sourceText = this.#document.getText();

    let accessorOffset = offset - 1;
    while (accessorOffset >= 0 && /\s/v.test(sourceText[accessorOffset])) {
      accessorOffset--;
    }

    if (accessorOffset < 0) {
      return null;
    }

    const accessor = sourceText[accessorOffset];
    if (accessor === "'" || accessor === '"') {
      let bracketOffset = accessorOffset - 1;
      while (bracketOffset >= 0 && /\s/v.test(sourceText[bracketOffset])) {
        bracketOffset--;
      }

      if (bracketOffset < 0 || sourceText[bracketOffset] !== '[') {
        return null;
      }

      accessorOffset = bracketOffset;
    } else if (accessor !== '.' && accessor !== '[') {
      return null;
    }

    let endOffset = accessorOffset - 1;
    while (endOffset >= 0 && /\s/v.test(sourceText[endOffset])) {
      endOffset--;
    }

    if (
      accessor === '[' &&
      endOffset >= 1 &&
      sourceText[endOffset] === '.' &&
      sourceText[endOffset - 1] === '?'
    ) {
      endOffset -= 2;
      while (endOffset >= 0 && /\s/v.test(sourceText[endOffset])) {
        endOffset--;
      }
    } else if (accessor === '.' && endOffset >= 0 && sourceText[endOffset] === '?') {
      endOffset--;
      while (endOffset >= 0 && /\s/v.test(sourceText[endOffset])) {
        endOffset--;
      }
    }

    if (endOffset < 0) {
      return null;
    }

    let startOffset = endOffset;
    while (startOffset >= 0 && isExtendedIdentifier(sourceText, startOffset)) {
      startOffset -= getCodeUnitLength(sourceText, startOffset);
    }

    const variableName = sourceText.slice(startOffset + 1, endOffset + 1);
    if (!isJsVariable(variableName)) {
      return null;
    }

    return { variableName, identifierOffset: endOffset };
  }

  public async findClassUsages(
    importUri: Uri,
    classNames: ReadonlySet<string>,
  ): Promise<ClassUsage[]> {
    const bindingNames = await this.getImportBindingNames(importUri);
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
      const usageKey = [node.getStart(this.sourceFile), node.getEnd()].join(':');
      if (seenUsages.has(usageKey)) {
        return;
      }

      seenUsages.add(usageKey);

      const range = createRange(this.sourceFile, start, end);
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
          addRange(node, node.name.getStart(this.sourceFile), node.name.getEnd(), 'property');
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
          addRange(node, argument.getStart(this.sourceFile), argument.getEnd(), 'element');
        }
      }

      forEachChild(node, visit);
    };

    visit(this.sourceFile);
    return usages;
  }

  public async getClassInfo(): Promise<ClassInfo | null> {
    if (!this.#position) {
      return null;
    }

    const startPosition = this.sourceFile.getPositionOfLineAndCharacter(
      this.#position.line,
      this.#position.character,
    );
    const finishPosition = startPosition > 0 ? startPosition - 1 : startPosition;

    for (let position = startPosition; position >= finishPosition; position--) {
      const node = findDeepestNodeAtPosition(this.sourceFile, position);
      if (node) {
        const access = findClickedAccessExpression(this.sourceFile, node, position);

        if (access) {
          const expression = unwrapExpression(access.expression);

          if (isIdentifier(expression)) {
            const variableName = expression.text;

            const className =
              isPropertyAccessExpressionLike(access) ? access.name.text
              : access.argumentExpression && isStringLiteralLike(access.argumentExpression) ?
                access.argumentExpression.text
              : null;
            const accessorType: ClassInfo['accessorType'] =
              isPropertyAccessExpressionLike(access) ? 'property' : 'element';

            if (className) {
              const symbol = this.typeChecker.getSymbolAtLocation(expression);
              if (symbol?.declarations) {
                for (const declaration of symbol.declarations) {
                  const importModule = getImportModuleFromDeclaration(declaration);

                  if (importModule) {
                    const importUri = await resolveImportPath(
                      this.#document.uri.fsPath,
                      importModule,
                    );

                    if (importUri) {
                      return { importUri, className, variableName, accessorType };
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return null;
  }

  public async getImportInfo(): Promise<ImportInfo | null> {
    if (!this.#position) {
      return null;
    }

    const offset = this.sourceFile.getPositionOfLineAndCharacter(
      this.#position.line,
      this.#position.character,
    );

    const variable = this.getVariableNameBeforeAccessor(offset);
    if (!variable) {
      return null;
    }

    const { variableName, identifierOffset } = variable;
    const node = findDeepestNodeAtPosition(this.sourceFile, identifierOffset);

    if (!node || !isIdentifier(node) || node.text !== variableName) {
      return null;
    }

    const symbol = this.typeChecker.getSymbolAtLocation(node);
    if (!symbol?.declarations) {
      return null;
    }

    for (const declaration of symbol.declarations) {
      const importModule = getImportModuleFromDeclaration(declaration);

      if (importModule) {
        const importUri = await resolveImportPath(this.#document.uri.fsPath, importModule);

        if (importUri) {
          return { importUri, variableName };
        }
      }
    }

    return null;
  }
}
