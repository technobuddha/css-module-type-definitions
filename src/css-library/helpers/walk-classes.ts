import selectorParser from 'postcss-selector-parser';

import { Range } from './range.ts';

export type ClassPosition = {
  name: string;
  range: Range;
};

export function walkClasses(selector: string): ClassPosition[] {
  return selectorParser<ClassPosition[]>((selectors) => {
    const results: ClassPosition[] = [];
    selectors.walkClasses(
      (sel) =>
        void results.push({
          name: sel.value,
          range: new Range(
            (sel.source?.start?.line ?? 1) - 1,
            (sel.source?.start?.column ?? 1) - 1,
            (sel.source?.end?.line ?? 1) - 1,
            (sel.source?.end?.column ?? 1) - 1,
          ),
        }),
    );
    return results;
  }).transformSync(selector);
}
