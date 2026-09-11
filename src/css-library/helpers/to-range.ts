import { type Node } from 'postcss-selector-parser';

import { Range } from './range.ts';

export function toRange(node: Node): Range {
  return new Range(
    (node.source?.start?.line ?? 1) - 1,
    node.source?.start?.column ?? 1,
    (node.source?.end?.line ?? 1) - 1,
    node.source?.end?.column ?? 1,
  );
}
