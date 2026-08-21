import { type SourceFile } from 'typescript';

import { type Usage } from './class-usage.ts';

export type State = {
  readonly bindingNames: ReadonlySet<string>;
  readonly seenUsages: Set<string>;
  readonly usages: Usage[];
  readonly sourceFile: SourceFile;
};
