import { type Node } from 'postcss';

import { Range } from '../position.ts';

export function range(node: Node): Range {
  return new Range(
    (node.source?.start?.line ?? 1) - 1,
    (node.source?.start?.column ?? 1) - 1,
    (node.source?.end?.line ?? 1) - 1,
    (node.source?.end?.column ?? 1) - 1,
  );
}
