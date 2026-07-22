import { type SourceFile } from 'typescript';

import { type ClassUsage } from './class-usage.ts';

export type State = {
  bindingNames: ReadonlySet<string>;
  localNames: ReadonlySet<string>;
  seenUsages: Set<string>;
  usages: ClassUsage[];
  sourceFile: SourceFile;
};
