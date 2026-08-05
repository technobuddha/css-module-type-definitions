import { type SourceFile } from 'typescript';

import { type Usage } from './class-usage.ts';

export type State = {
  bindingNames: ReadonlySet<string>;
  seenUsages: Set<string>;
  usages: Usage[];
  sourceFile: SourceFile;
};
