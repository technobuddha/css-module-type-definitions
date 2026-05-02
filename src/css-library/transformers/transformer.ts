import path from 'node:path';

import { type CompilerOptions } from 'typescript';

import { type Logger } from '../../common/logger.ts';
import { type Options } from '../../common/options.ts';

import { extractClassOffsetsFromCss } from './extract-class-offsets-from-css.ts';
import { transformCustom } from './transform-custom.ts';
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
  const { customRenderer, rendererOptions } = options;

  const result =
    customRenderer ?
      await transformCustom(css, { customRenderer, filename, compilerOptions, logger })
    : ext === '.less' ?
      await transformLess(css, { filename, directory, options: rendererOptions?.less })
    : ext === '.scss' || ext === '.sass' ?
      transformSass(css, { filename, directory, options: rendererOptions?.sass, compilerOptions })
    : ext === '.styl' ? transformStylus(css, { filename, options: rendererOptions?.stylus })
    : { css, classOffsets: extractClassOffsetsFromCss(css, { filename }) };

  return result;
}
