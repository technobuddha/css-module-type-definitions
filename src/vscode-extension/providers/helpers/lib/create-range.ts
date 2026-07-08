import { type SourceFile } from 'typescript';
import { Range } from 'vscode';

export function createRange(sourceFile: SourceFile, start: number, end: number): Range {
  const startPosition = sourceFile.getLineAndCharacterOfPosition(start);
  const endPosition = sourceFile.getLineAndCharacterOfPosition(end);

  return new Range(
    startPosition.line,
    startPosition.character,
    endPosition.line,
    endPosition.character,
  );
}
