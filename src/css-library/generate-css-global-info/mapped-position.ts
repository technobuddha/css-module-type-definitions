import { type Node } from 'postcss';

import { MappedPosition } from '../position.ts';
import { type SourceMapConsumer } from '../source-map.ts';

import { range } from './range.ts';

export function mappedPosition(node: Node, smc: SourceMapConsumer | string): MappedPosition {
  if (typeof smc === 'string') {
    const r = range(node);
    return new MappedPosition(smc, r.start.line, r.start.column);
  }
  return smc.originalPosition(range(node).start);
}
