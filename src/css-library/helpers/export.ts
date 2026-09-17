import { type Location } from './location.ts';

export type ExportType = 'class' | 'id' | 'keyframes' | 'value' | 'variable';
export type ExportScope = 'global' | 'local';

export type Export = {
  readonly type: ExportType;
  readonly location: Location;
  readonly snippet: string;
  readonly scope: ExportScope;
};
