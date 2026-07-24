import { type Range, type TextDocument } from 'vscode';

export type Usage = {
  range: Range;
  accessorType: 'property' | 'element';
};

export type ClassUsage = {
  document: TextDocument;
  usages: Usage[];
};
