import { type Range, type TextDocument } from 'vscode';

export type Usage = {
  localName: string;
  range: Range;
  accessorType: 'property' | 'element';
};

export type ClassUsage = {
  document: TextDocument;
  usages: Usage[];
};
