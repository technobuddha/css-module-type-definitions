import { createSourceFile, ScriptTarget, type SourceFile } from 'typescript';
import { type TextDocument } from 'vscode';

import { scriptKind } from './script-kind.ts';

export function getSourceFile(document: TextDocument): SourceFile {
  const filename = document.fileName;

  return createSourceFile(
    document.fileName,
    document.getText(),
    ScriptTarget.Latest,
    true,
    scriptKind(filename),
  );
}
