import { type CssLocation } from './extract-class-ranges-from-css.ts';
import { type CMTDRange } from './position.ts';

export type CssInfo = {
  files: Record<string, string>;
  dtsFile: string;
  mapFile: string;
  classLocations: Map<string, CssLocation[]>;
  includedFiles: Set<string>;
  classLocal: Map<string, Set<string>>;
  localClass: Map<string, Set<string>>;
  dtsRange: Map<string, CMTDRange>;
};
