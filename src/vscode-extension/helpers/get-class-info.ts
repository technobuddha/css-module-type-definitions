import { type Position, type TextDocument } from 'vscode';

type ClassInfo = {
  readonly className: string;
};

export function getClassInfo(document: TextDocument, position: Position): ClassInfo | null {
  const range = document.getWordRangeAtPosition(position);
  if (range?.isSingleLine) {
    let className = document.getText(range);

    if (className.startsWith('.')) {
      className = className.slice(1);

      return { className };
    }
  }

  return null;
}
