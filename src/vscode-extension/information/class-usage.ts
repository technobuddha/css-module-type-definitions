import { type TextDocument } from 'vscode';

import { type Usage } from './usage.ts';

export type ClassUsage = {
  readonly document: TextDocument;
  readonly usages: Usage[];
};
