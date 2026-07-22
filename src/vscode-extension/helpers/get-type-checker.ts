import {
  type CompilerOptions,
  createCompilerHost,
  createProgram,
  JsxEmit,
  ModuleKind,
  ScriptTarget,
  type SourceFile,
  type TypeChecker,
} from 'typescript';
import { type TextDocument } from 'vscode';

export function getTypeChecker(document: TextDocument, sourceFile: SourceFile): TypeChecker {
  const sourceText = document.getText();

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

  host.fileExists = (filename): boolean => filename === sourceFile.fileName;
  host.readFile = (filename): string | undefined =>
    filename === sourceFile.fileName ? sourceText : undefined;
  host.getSourceFile = (filename): SourceFile | undefined =>
    filename === sourceFile.fileName ? sourceFile : undefined;

  const program = createProgram([sourceFile.fileName], compilerOptions, host);

  return program.getTypeChecker();
}
