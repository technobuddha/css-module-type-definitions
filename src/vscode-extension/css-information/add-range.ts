import { type MemberName, type Node, type StringLiteralLike } from 'typescript';

import { createRange } from '../helpers/index.ts';

import { type Usage } from './class-usage.ts';
import { type State } from './state.ts';

export function addRange(
  node: Node,
  target: MemberName | StringLiteralLike,
  accessorType: Usage['accessorType'],
  state: State,
): void {
  const { seenUsages, usages, sourceFile } = state;

  const start = target.getStart(sourceFile);
  const end = target.getEnd();
  const localName = target.text;

  const usageKey = [node.getStart(sourceFile), node.getEnd()].join(':');
  if (seenUsages.has(usageKey)) {
    return;
  }

  seenUsages.add(usageKey);

  const range = createRange(sourceFile, start, end);
  usages.push({ localName, range, accessorType });
}
