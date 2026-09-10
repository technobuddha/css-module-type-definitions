import { Position } from 'vscode';

import { type Position as CssPosition } from '../../css-library/index.ts';

export function toPosition(position: CssPosition): Position {
  return new Position(position.line, position.column);
}
