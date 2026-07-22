import { type Range } from 'vscode';

export type ClassUsage = {
  range: Range;
  accessorType: 'property' | 'element';
};
