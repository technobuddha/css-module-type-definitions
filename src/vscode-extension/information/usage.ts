import { type Range } from 'vscode';

export type Usage = {
  readonly localName: string;
  readonly range: Range;
  readonly accessorType: 'property' | 'element';
};
