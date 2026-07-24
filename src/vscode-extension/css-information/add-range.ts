import { type Node } from 'typescript';

import { createRange } from '../helpers/create-range.ts';

import { type Usage } from './class-usage.ts';
import { type State } from './state.ts';

export function addRange(
  node: Node,
  start: number,
  end: number,
  accessorType: Usage['accessorType'],
  state: State,
): void {
  const { seenUsages, usages, sourceFile } = state;
  const usageKey = [node.getStart(sourceFile), node.getEnd()].join(':');
  if (seenUsages.has(usageKey)) {
    return;
  }

  seenUsages.add(usageKey);

  const range = createRange(sourceFile, start, end);
  usages.push({ range, accessorType });
}
