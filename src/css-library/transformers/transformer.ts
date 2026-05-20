import path from 'node:path';

import { type CompilerOptions } from 'typescript';

import { type Logger } from '../../common/logger.ts';
import { type Options } from '../../common/options.ts';

import { extractClassOffsetsFromCss } from './extract-class-offsets-from-css.ts';
import { transformLess } from './transform-less.ts';
import { transformSass } from './transform-sass.ts';
import { transformStylus } from './transform-stylus.ts';
import { type TransformerReturn } from './transformer-return.ts';

type TransformerArguments = {
  filename: string;
  directory: string;
  options: Options;
  compilerOptions: CompilerOptions;
  logger: Logger;
};

export async function transformer(
  css: string,
  { filename, directory, options, compilerOptions, logger }: TransformerArguments,
): Promise<TransformerReturn> {
  const { ext } = path.parse(filename);

  switch (ext) {
    case '.less': {
      return transformLess(css, {
        filename,
        directory,
        options,
        logger,
      });
    }

    case '.sass': {
      return transformSass(css, {
        filename,
        directory,
        options,
        compilerOptions,
        logger,
      });
    }

    case '.scss': {
      return transformSass(css, {
        filename,
        directory,
        options,
        compilerOptions,
        logger,
      });
    }

    case '.styl': {
      return transformStylus(css, {
        filename,
        options,
        logger,
      });
    }

    case '.stylus': {
      return transformStylus(css, {
        filename,
        options,
        logger,
      });
    }

    default: {
      return { css, classOffsets: extractClassOffsetsFromCss(css, { filename, logger }) };
    }
  }
}
