import { type Location } from 'vscode';

import { canonicalPath } from './cononical-path.ts';
import { isDuplicateLocation } from './is-duplicate-location.ts';
import { preferLocation } from './prefer-location.ts';

export function normalizeLocations(locations: Location[]): Location[] {
  const unique = new Map<string, { canonicalPath: string; location: Location }>();

  for (const location of locations) {
    const cp = canonicalPath(location.uri.fsPath);
    const key = [
      cp,
      location.range.start.line,
      location.range.start.character,
      location.range.end.line,
      location.range.end.character,
    ].join(':');

    unique.set(key, { canonicalPath: cp, location });
  }

  const sorted = unique
    .values()
    .toArray()
    .sort((left, right) => {
      if (left.canonicalPath !== right.canonicalPath) {
        return left.canonicalPath.localeCompare(right.canonicalPath);
      }

      if (left.location.range.start.line !== right.location.range.start.line) {
        return left.location.range.start.line - right.location.range.start.line;
      }

      if (left.location.range.start.character !== right.location.range.start.character) {
        return left.location.range.start.character - right.location.range.start.character;
      }

      if (left.location.range.end.line !== right.location.range.end.line) {
        return left.location.range.end.line - right.location.range.end.line;
      }

      return left.location.range.end.character - right.location.range.end.character;
    });

  const deduped: Location[] = [];
  let previousCanonicalPath: string | null = null;

  for (const { canonicalPath, location } of sorted) {
    const previous = deduped.at(-1);
    if (
      previous &&
      previousCanonicalPath === canonicalPath &&
      isDuplicateLocation(previous, location)
    ) {
      deduped[deduped.length - 1] = preferLocation(previous, location);
      continue;
    }

    deduped.push(location);
    previousCanonicalPath = canonicalPath;
  }

  return deduped;
}
