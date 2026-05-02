import { type RawSourceMap } from 'source-map-js';

import { type Offset } from '../offset.ts';

export type TransformerReturn = {
  css: string;
  sourceMap?: RawSourceMap;
  classOffsets: Map<string, Offset>;
};
