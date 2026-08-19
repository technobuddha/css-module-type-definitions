import { type CssLocation } from './extract-locations.ts';
import { type CMTDRange } from './position.ts';

export type CssInfo = {
  dtsFilename: string;
  dtsContents: string;
  locationsOfClass: Map<string, CssLocation[]>;
  includedFiles: Set<string>;
  classLocal: Map<string, Set<string>>;
  classScope: Record<string, string>;
  localClass: Map<string, Set<string>>;
  dtsRange: Map<string, CMTDRange>;
  hasDts: boolean;
};
