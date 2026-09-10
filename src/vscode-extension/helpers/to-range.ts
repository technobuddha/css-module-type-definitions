import { Range } from 'vscode';

import { type Range as CssRange } from '../../css-library/index.ts';

import { toPosition } from './to-position.ts';

export function toRange(range: CssRange): Range {
  return new Range(toPosition(range.start), toPosition(range.end));
}
