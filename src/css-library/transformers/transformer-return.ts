import { type RawSourceMap } from 'source-map-js';

export type TransformerReturn = {
  css: string;
  sourceMap?: RawSourceMap;
};
