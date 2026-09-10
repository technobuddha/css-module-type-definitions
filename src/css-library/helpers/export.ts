import { type Location } from './location.ts';

type ExportType = 'class' | 'keyframe' | 'value' | 'value-class';

export type Export = {
  readonly type: ExportType;
  readonly location: readonly Location[];
  readonly snippet: readonly string[];
};
