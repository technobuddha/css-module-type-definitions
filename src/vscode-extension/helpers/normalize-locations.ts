import { SerializedSet } from '@technobuddha/library';
import { Location, Position, Range, Uri } from 'vscode';

import { canonicalPath } from './canonical-path.ts';

type SerializableLocation = {
  readonly uri: string;
  readonly range: {
    readonly start: { line: number; character: number };
    readonly end: { line: number; character: number };
  };
};

export function normalizeLocations(locations: Location[]): Location[] {
  return Array.from(
    new SerializedSet<SerializableLocation>(
      locations.map((location) => ({
        uri: canonicalPath(location.uri.fsPath),
        range: {
          start: {
            line: location.range.start.line,
            character: location.range.start.character,
          },
          end: {
            line: location.range.end.line,
            character: location.range.end.character,
          },
        },
      })),
    ),
  )
    .sort(
      (a, b) =>
        a.uri.localeCompare(b.uri) ||
        a.range.start.line - b.range.start.line ||
        a.range.start.character - b.range.start.character ||
        a.range.end.line - b.range.end.line ||
        a.range.end.character - b.range.end.character,
    )
    .map(
      (loc) =>
        new Location(
          Uri.file(loc.uri),
          new Range(
            new Position(loc.range.start.line, loc.range.start.character),
            new Position(loc.range.end.line, loc.range.end.character),
          ),
        ),
    );
}
