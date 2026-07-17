import path from 'node:path';

import { type Logger, type NormalizedOptions } from '../../common/index.ts';

import { type RawSourceMap } from '../source-map.ts';

import { transformLess } from './transform-less.ts';
import { transformSass } from './transform-sass.ts';
import { transformStylus } from './transform-stylus.ts';

export type TransformerReturn = {
  css: string;
  includedFiles: Set<string>;
  sourceMap?: RawSourceMap;
};

export type TransformerArguments = {
  filename: string;
  directory: string;
  options: NormalizedOptions;
  logger: Logger;
};

export async function transformer(
  css: string,
  args: TransformerArguments,
): Promise<TransformerReturn> {
  const { filename } = args;
  const { ext } = path.parse(filename);

  switch (ext) {
    case '.less': {
      return transformLess(css, args);
    }

    case '.sass': {
      return transformSass(css, args);
    }

    case '.scss': {
      return transformSass(css, args);
    }

    case '.styl': {
      return transformStylus(css, args);
    }

    case '.stylus': {
      return transformStylus(css, args);
    }

    default: {
      return { css, includedFiles: new Set() };
    }
  }
}
