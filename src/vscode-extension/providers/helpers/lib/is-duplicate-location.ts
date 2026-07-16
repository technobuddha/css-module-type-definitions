import { type Location } from 'vscode';

export function isDuplicateLocation(left: Location, right: Location): boolean {
  if (left.uri.fsPath !== right.uri.fsPath) {
    return false;
  }

  if (left.range.start.line !== right.range.start.line) {
    return false;
  }

  if (left.range.end.line !== right.range.end.line) {
    return false;
  }

  return (
    left.range.start.character <= right.range.end.character &&
    right.range.start.character <= left.range.end.character
  );
}
