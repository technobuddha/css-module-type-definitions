import path from 'node:path';

import { type CompilerOptions } from 'typescript';

import { type Options } from '../../common/options.ts';

import { type Logger } from '../../common/logger.ts';

import { extractClassOffsetsFromCss } from './extract-class-offsets-from-css.ts';
import { transformLess } from './transform-less.ts';
import { transformSass } from './transform-sass.ts';
import { transformStylus } from './transform-stylus.ts';
import { type TransformerReturn } from './transformer-return.ts';

type TransformerArguments = {
  filename: string;
  directory: string;
  options?: Options;
  compilerOptions: CompilerOptions;
  logger?: Logger;
};

export async function transformer(
  css: string,
  { filename, directory, options = {}, compilerOptions, logger }: TransformerArguments,
): Promise<TransformerReturn> {
  const { ext } = path.parse(filename);
  const { preprocessor } = options;

  const result =
    ext === '.less' ?
      transformLess(css, {
        filename,
        directory,
        options: preprocessor?.less,
        logger,
      })
    : ext === '.sass' ?
      transformSass(css, {
        filename,
        directory,
        options: preprocessor?.sass,
        compilerOptions,
      })
    : ext === '.scss' ?
      transformSass(css, {
        filename,
        directory,
        options: preprocessor?.scss,
        compilerOptions,
      })
    : ext === '.styl' ?
      transformStylus(css, {
        filename,
        options: preprocessor?.styl ?? preprocessor?.stylus,
      })
    : ext === '.stylus' ?
      transformStylus(css, {
        filename,
        options: preprocessor?.stylus ?? preprocessor?.styl,
      })
    : { css, classOffsets: extractClassOffsetsFromCss(css, { filename }) };

  return result;
}
