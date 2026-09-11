import { type Location } from './location.ts';

export type ExportType = 'class' | 'id' | 'keyframe' | 'value' | 'value-class';
export type ExportScope = 'global' | 'local';

export type Export = {
  readonly type: ExportType;
  readonly location: Location;
  readonly snippet: string;
  readonly scope: ExportScope;
};
