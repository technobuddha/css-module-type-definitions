import { type SourceFile } from 'typescript';

import { type Usage } from './class-usage.ts';

export class State {
  public readonly bindingNames: ReadonlySet<string>;
  public readonly seenUsages: Set<string> = new Set();
  public readonly usages: Usage[] = [];
  public readonly sourceFile: SourceFile;

  public constructor(bindingNames: ReadonlySet<string>, sourceFile: SourceFile) {
    this.bindingNames = bindingNames;
    this.sourceFile = sourceFile;
  }
}
