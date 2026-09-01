import { type CssLocation } from './extract-locations.ts';
import { type PosRange } from './position.ts';

export type CssGlobalInfo = {
  locationsOfClassName: Map<string, CssLocation[]>;
  importedFiles: Set<string>;
};

export type CssModuleInfo = {
  readonly dtsFilename: string;
  readonly dtsContents: string;
  readonly locationsOfClassName: ReadonlyMap<string, readonly CssLocation[]>;
  readonly importedFiles: ReadonlySet<string>;
  readonly localNamesOfClassName: ReadonlyMap<string, ReadonlySet<string>>;
  readonly scopeNameOfClassName: ReadonlyMap<string, string>;
  readonly classNamesOfLocalName: ReadonlyMap<string, ReadonlySet<string>>;
  readonly dtsRange: ReadonlyMap<string, PosRange>;
  readonly hasDts: boolean;
};
