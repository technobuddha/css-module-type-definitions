import { type CssLocation } from './extract-class-ranges-from-css.ts';

export type CssInfo = {
  files: Record<string, string>;
  locals: Map<string, CssLocation[]>;
  includedFiles: Set<string>;
  classLocal: Map<string, Set<string>>;
  localClass: Map<string, Set<string>>;
};
