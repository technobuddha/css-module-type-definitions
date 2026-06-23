import path from 'node:path';

import { type RawSourceMap } from 'source-map-js';
import { type CompilerOptions } from 'typescript';

import { type Logger } from '../../common/logger.ts';
import { type NormalizedOptions } from '../../common/options.ts';

import { transformLess } from './transform-less.ts';
import { transformSass } from './transform-sass.ts';
import { transformStylus } from './transform-stylus.ts';

export type TransformerReturn = {
  css: string;
  sourceMap?: RawSourceMap;
};

export type TransformerArguments = {
  filename: string;
  directory: string;
  options: NormalizedOptions;
  compilerOptions: CompilerOptions;
  logger: Logger;
};

export async function transformer(
  css: string,
  { filename, directory, options, compilerOptions, logger }: TransformerArguments,
): Promise<TransformerReturn> {
  const { ext } = path.parse(filename);
  const args = {
    filename,
    directory,
    options,
    logger,
    compilerOptions,
  };

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
      return { css };
    }
  }
}
