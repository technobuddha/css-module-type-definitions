import { Location, Position, Range, Uri } from 'vscode';
import { Utils } from 'vscode-uri';

import { type CssInfo } from '../../../../css-library/index.ts';

type ClassReferenceInfo = {
  classNames: Set<string>;
  declarationLocations: Location[];
};

export function classReferenceInfo(
  types: CssInfo | undefined,
  importUri: Uri,
  className: string,
): ClassReferenceInfo | null {
  if (types) {
    const extracted = types.classes.get(className);
    if (extracted) {
      const aliases = types.aliases.get(className);
      if (aliases) {
        return {
          classNames: new Set(aliases),
          declarationLocations: extracted.map(
            ({
              location: {
                source,
                range: { start, end },
              },
            }) =>
              new Location(
                Uri.joinPath(Utils.dirname(importUri), source),
                new Range(
                  new Position(start.line, start.column),
                  new Position(end.line, end.column),
                ),
              ),
          ),
        };
      }
    }
  }

  return null;
}
