import { type Location } from 'vscode';

export function preferLocation(left: Location, right: Location): Location {
  const leftWidth =
    (left.range.end.line - left.range.start.line) * Number.MAX_SAFE_INTEGER +
    (left.range.end.character - left.range.start.character);
  const rightWidth =
    (right.range.end.line - right.range.start.line) * Number.MAX_SAFE_INTEGER +
    (right.range.end.character - right.range.start.character);

  return rightWidth < leftWidth ? right : left;
}
