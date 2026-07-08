import { Location, Position, Uri } from 'vscode';
import { Utils } from 'vscode-uri';

import { type CssInfo } from '../../../../css-library/generate-types-from-css.ts';

type ClassReferenceInfo = {
  classNames: Set<string>;
  declarationLocation: Location | null;
};

export function classReferenceInfo(
  types: CssInfo | undefined,
  importUri: Uri,
  className: string,
): ClassReferenceInfo {
  const classNames = new Set<string>([className]);
  if (types) {
    const extracted = types.classes.get(className);
    if (extracted) {
      const aliases = types.aliases.get(className);
      if (aliases) {
        for (const alias of aliases) {
          classNames.add(alias);
        }
      }

      const [{ start, source }] = extracted;
      const target = Uri.joinPath(Utils.dirname(importUri), source);

      return {
        classNames,
        declarationLocation: new Location(target, new Position(start.line - 1, start.column)),
      };
    }
  }
  return { classNames, declarationLocation: null };
}
