import { Location, Position, Range, Uri } from 'vscode';
import { Utils } from 'vscode-uri';

import { type CMTDLocation } from '../../css-library/index.ts';

export function toLocation(location: CMTDLocation, importUri: Uri): Location {
  const { source, range } = location;
  return new Location(
    Uri.joinPath(Utils.dirname(importUri), source),
    new Range(
      new Position(range.start.line, range.start.column),
      new Position(range.end.line, range.end.column),
    ),
  );
}
