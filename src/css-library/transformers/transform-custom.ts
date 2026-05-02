import { type CompilerOptions } from 'typescript';

import { type Logger } from '../../common/logger.ts';
import { type CustomRenderer, type Options } from '../../common/options.ts';

import { extractClassOffsetsFromCss } from './extract-class-offsets-from-css.ts';
import { type TransformerReturn } from './transformer-return.ts';

type TransformCustomArguments = {
  filename: string;
  customRenderer: NonNullable<Options['customRenderer']>;
  logger?: Logger;
  compilerOptions: CompilerOptions;
};

export async function transformCustom(
  css: string,
  { customRenderer, filename, logger, compilerOptions }: TransformCustomArguments,
): Promise<TransformerReturn> {
  const renderer =
    typeof customRenderer === 'string' ?
      ((await import(customRenderer).then((mod) => mod.default ?? mod)) as CustomRenderer)
    : customRenderer;

  let result = await Promise.resolve(renderer(css, { filename, logger, compilerOptions }));
  if (typeof result === 'string') {
    result = { css: result };
  }

  return {
    css: result.css,
    sourceMap: result.sourceMap,
    classOffsets: extractClassOffsetsFromCss(result.css, { filename }),
  };
}
