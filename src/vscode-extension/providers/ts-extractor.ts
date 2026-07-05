import path from 'node:path';

import { searchParentSync } from '@technobuddha/library';
import ts from 'typescript';
import { type Position, type TextDocument, Uri } from 'vscode';

type ClassInfo = {
  importUri: Uri;
  className: string;
  variableName: string;
};

type ImportInfo = {
  importUri: Uri;
  variableName: string;
};

type ElementAccessExpressionLike = ts.ElementAccessExpression | ts.ElementAccessChain;
type PropertyAccessExpressionLike = ts.PropertyAccessExpression | ts.PropertyAccessChain;
type AccessExpressionLike = PropertyAccessExpressionLike | ElementAccessExpressionLike;

export class TSExtractor {
  readonly #document: TextDocument;
  readonly #position: Position;
  #sourceFile?: ts.SourceFile;
  #typeChecker?: ts.TypeChecker;

  public constructor(document: TextDocument, position: Position) {
    this.#document = document;
    this.#position = position;
  }

  private getScriptKind(filename: string): ts.ScriptKind {
    if (filename.endsWith('.tsx')) {
      return ts.ScriptKind.TSX;
    }

    if (filename.endsWith('.jsx')) {
      return ts.ScriptKind.JSX;
    }

    if (filename.endsWith('.js') || filename.endsWith('.mjs') || filename.endsWith('.cjs')) {
      return ts.ScriptKind.JS;
    }

    return ts.ScriptKind.TS;
  }

  private get sourceFile(): ts.SourceFile {
    if (this.#sourceFile) {
      return this.#sourceFile;
    }

    const filename = this.#document.fileName;

    this.#sourceFile = ts.createSourceFile(
      this.#document.fileName,
      this.#document.getText(),
      ts.ScriptTarget.Latest,
      true,
      this.getScriptKind(filename),
    );

    return this.#sourceFile;
  }

  private get typeChecker(): ts.TypeChecker {
    if (this.#typeChecker) {
      return this.#typeChecker;
    }

    const sourceText = this.#document.getText();

    const compilerOptions: ts.CompilerOptions = {
      allowJs: true,
      checkJs: false,
      jsx: ts.JsxEmit.Preserve,
      module: ts.ModuleKind.ESNext,
      noLib: true,
      noResolve: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.Latest,
    };

    const host = ts.createCompilerHost(compilerOptions, true);

    host.fileExists = (filename): boolean => filename === this.sourceFile.fileName;
    host.readFile = (filename): string | undefined =>
      filename === this.sourceFile.fileName ? sourceText : undefined;
    host.getSourceFile = (filename): ts.SourceFile | undefined =>
      filename === this.sourceFile.fileName ? this.sourceFile : undefined;

    const program = ts.createProgram([this.sourceFile.fileName], compilerOptions, host);

    this.#typeChecker = program.getTypeChecker();
    return this.#typeChecker;
  }

  private async resolveImportPath(importModule: string): Promise<Uri | null> {
    const filename = this.#document.uri.fsPath;

    if (importModule.startsWith('.') || importModule.startsWith('/')) {
      return Uri.file(path.resolve(path.dirname(filename), importModule));
    }

    let compilerOptions: ts.CompilerOptions = {};

    const searchResult = searchParentSync('tsconfig.json', {
      startDirectory: path.dirname(filename),
      limit: 1,
    });

    if (searchResult.length > 0) {
      const tsconfigPath = path.resolve(
        path.dirname(filename),
        searchResult[0].dir,
        searchResult[0].files[0],
      );

      // Load and parse tsconfig
      const configFile = ts.readConfigFile(tsconfigPath, (filename) => ts.sys.readFile(filename));
      if (configFile.error) {
        const errorMessage =
          typeof configFile.error.messageText === 'string' ?
            configFile.error.messageText
          : configFile.error.messageText.messageText;
        throw new Error(`Error reading tsconfig: ${errorMessage}`);
      }

      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(tsconfigPath),
      );

      // Create module resolution host
      compilerOptions = parsedConfig.options;
    }

    const resolved = ts.resolveModuleName(importModule, filename, compilerOptions, ts.sys);
    if (resolved.resolvedModule?.resolvedFileName) {
      return Uri.file(resolved.resolvedModule.resolvedFileName);
    }

    return null;
  }

  private findClickedAccessExpression(
    node: ts.Node,
    position: number,
  ): AccessExpressionLike | null {
    let current: ts.Node | undefined = node;

    while (current) {
      if (this.isAccessExpressionLike(current)) {
        const range = this.getPropertyNameRange(this.sourceFile, current);
        if (range && this.isWithin(position, range.start, range.end)) {
          return current;
        }
      }

      current = current.parent;
    }

    return null;
  }

  private findDeepestNodeAtPosition(position: number): ts.Node | null {
    let result: ts.Node | null = null;

    function visit(node: ts.Node): void {
      if (position < node.getFullStart() || position >= node.getEnd()) {
        return;
      }

      result = node;
      ts.forEachChild(node, visit);
    }

    visit(this.sourceFile);
    return result;
  }

  private getImportModuleFromDeclaration(declaration: ts.Declaration): string | null {
    const importDeclarationModule = this.getImportDeclarationModule(declaration);
    if (importDeclarationModule) {
      return importDeclarationModule;
    }

    const importEqualsModule = this.getImportEqualsModule(declaration);
    if (importEqualsModule) {
      return importEqualsModule;
    }

    if (ts.isVariableDeclaration(declaration)) {
      return this.getRequireCallModule(declaration.initializer);
    }

    return null;
  }

  private getImportDeclarationModule(node: ts.Node): string | null {
    let current: ts.Node | undefined = node;

    while (current) {
      if (ts.isImportDeclaration(current) && ts.isStringLiteral(current.moduleSpecifier)) {
        return current.moduleSpecifier.text;
      }

      current = current.parent;
    }

    return null;
  }

  private getImportEqualsModule(node: ts.Node): string | null {
    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      return node.moduleReference.expression.text;
    }

    return null;
  }

  private getPropertyNameRange(
    sourceFile: ts.SourceFile,
    access: AccessExpressionLike,
  ): { start: number; end: number } | null {
    if (this.isPropertyAccessExpressionLike(access)) {
      return {
        start: access.name.getStart(sourceFile),
        end: access.name.getEnd(),
      };
    }

    const { argumentExpression } = access;
    if (!argumentExpression || !ts.isStringLiteralLike(argumentExpression)) {
      return null;
    }

    return {
      start: argumentExpression.getStart(sourceFile),
      end: argumentExpression.getEnd(),
    };
  }

  private getRequireCallModule(initializer: ts.Expression | undefined): string | null {
    if (!initializer) {
      return null;
    }

    const expression = this.unwrapExpression(initializer);
    if (!ts.isCallExpression(expression)) {
      return null;
    }

    const callee = this.unwrapExpression(expression.expression);
    const [argument] = expression.arguments;

    if (!ts.isIdentifier(callee) || callee.text !== 'require') {
      return null;
    }

    return argument && ts.isStringLiteralLike(argument) ? argument.text : null;
  }

  private isElementAccessExpressionLike(node: ts.Node): node is ElementAccessExpressionLike {
    return ts.isElementAccessExpression(node) || ts.isElementAccessChain(node);
  }

  private isPropertyAccessExpressionLike(node: ts.Node): node is PropertyAccessExpressionLike {
    return ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node);
  }

  private isAccessExpressionLike(node: ts.Node): node is AccessExpressionLike {
    return this.isPropertyAccessExpressionLike(node) || this.isElementAccessExpressionLike(node);
  }

  private isWithin(position: number, start: number, end: number): boolean {
    return position >= start && position <= end;
  }

  private unwrapExpression(expression: ts.Expression): ts.Expression {
    let current = expression;

    while (
      ts.isAsExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current)
    ) {
      current = current.expression;
    }

    return current;
  }

  private getVariableNameBeforeDot(
    offset: number,
  ): { variableName: string; identifierOffset: number } | null {
    const sourceText = this.#document.getText();

    let dotOffset = offset - 1;
    while (dotOffset >= 0 && /\s/v.test(sourceText[dotOffset])) {
      dotOffset--;
    }

    if (dotOffset < 0 || sourceText[dotOffset] !== '.') {
      return null;
    }

    let endOffset = dotOffset - 1;
    while (endOffset >= 0 && /\s/v.test(sourceText[endOffset])) {
      endOffset--;
    }

    if (endOffset < 0) {
      return null;
    }

    const identifierPart = /[$_\u{200C}\u{200D}\p{ID_Continue}]/v;
    const identifier = /^[$_\p{ID_Start}][$_\u{200C}\u{200D}\p{ID_Continue}]*$/v;

    let startOffset = endOffset;
    while (startOffset >= 0 && identifierPart.test(sourceText[startOffset])) {
      startOffset--;
    }

    const variableName = sourceText.slice(startOffset + 1, endOffset + 1);
    if (!identifier.test(variableName)) {
      return null;
    }

    return { variableName, identifierOffset: endOffset };
  }

  public async getClassInfo(): Promise<ClassInfo | null> {
    const startPosition = this.sourceFile.getPositionOfLineAndCharacter(
      this.#position.line,
      this.#position.character,
    );
    const finishPosition = startPosition > 0 ? startPosition - 1 : startPosition;

    for (let position = startPosition; position >= finishPosition; position--) {
      const node = this.findDeepestNodeAtPosition(position);
      if (node) {
        const access = this.findClickedAccessExpression(node, position);

        if (access) {
          const expression = this.unwrapExpression(access.expression);

          if (ts.isIdentifier(expression)) {
            const variableName = expression.text;

            const className =
              this.isPropertyAccessExpressionLike(access) ? access.name.text
              : access.argumentExpression && ts.isStringLiteralLike(access.argumentExpression) ?
                access.argumentExpression.text
              : null;

            if (className) {
              const symbol = this.typeChecker.getSymbolAtLocation(expression);
              if (symbol?.declarations) {
                for (const declaration of symbol.declarations) {
                  const importModule = this.getImportModuleFromDeclaration(declaration);

                  if (importModule) {
                    const importUri = await this.resolveImportPath(importModule);

                    if (importUri) {
                      return { importUri, className, variableName };
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
    const offset = this.sourceFile.getPositionOfLineAndCharacter(
      this.#position.line,
      this.#position.character,
    );

    const variable = this.getVariableNameBeforeDot(offset);
    if (!variable) {
      return null;
    }

    const { variableName, identifierOffset } = variable;
    const node = this.findDeepestNodeAtPosition(identifierOffset);

    if (!node || !ts.isIdentifier(node) || node.text !== variableName) {
      return null;
    }

    const symbol = this.typeChecker.getSymbolAtLocation(node);
    if (!symbol?.declarations) {
      return null;
    }

    for (const declaration of symbol.declarations) {
      const importModule = this.getImportModuleFromDeclaration(declaration);

      if (importModule) {
        const importUri = await this.resolveImportPath(importModule);

        if (importUri) {
          return { importUri, variableName };
        }
      }
    }

    return null;
  }
}
