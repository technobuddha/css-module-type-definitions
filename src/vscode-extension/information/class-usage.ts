import { type Range, type TextDocument } from 'vscode';

export type Usage = {
  readonly localName: string;
  readonly range: Range;
  readonly accessorType: 'property' | 'element';
};

export type ClassUsage = {
  readonly document: TextDocument;
  readonly usages: Usage[];
};
