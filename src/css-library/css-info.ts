import { type CssLocation } from './extract-locations.ts';
import { type CMTDRange } from './position.ts';

export type CssInfo = {
  classLocations: Map<string, CssLocation[]>;
  includedFiles: Set<string>;
};

export type CssModuleInfo = {
  readonly dtsFilename: string;
  readonly dtsContents: string;
  readonly locationsOfClass: ReadonlyMap<string, CssLocation[]>;
  readonly includedFiles: ReadonlySet<string>;
  readonly classLocal: ReadonlyMap<string, Set<string>>;
  readonly classScope: Record<string, string>;
  readonly localClass: ReadonlyMap<string, Set<string>>;
  readonly dtsRange: ReadonlyMap<string, CMTDRange>;
  readonly hasDts: boolean;
};
