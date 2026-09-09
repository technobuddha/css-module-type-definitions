import { type Position, type TextDocument } from 'vscode';

type ClassInfo = {
  readonly exportName: string;
};

export function getClassInfo(document: TextDocument, position: Position): ClassInfo | null {
  const range = document.getWordRangeAtPosition(position);
  if (range?.isSingleLine) {
    let exportName = document.getText(range);

    if (exportName.startsWith('.')) {
      exportName = exportName.slice(1);

      return { exportName };
    }
  }

  return null;
}
