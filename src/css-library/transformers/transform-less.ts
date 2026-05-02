import path from 'node:path';

import { empty } from '@technobuddha/library';
import less from 'less';

import { extractClassOffsetsFromCss } from './extract-class-offsets-from-css.ts';
import { type TransformerReturn } from './transformer-return.ts';

type TransformLessArguments = {
  filename: string;
  directory: string;
  options?: Partial<Less.Options>;
};

export async function transformLess(
  lessSource: string,
  { filename, directory, options = {} }: TransformLessArguments,
): Promise<TransformerReturn> {
  const output = await less
    .render(lessSource, {
      filename: path.basename(filename),
      paths: [directory],
      sourceMap: {},
      ...options,
    })
    .catch((error: Less.RenderError) => {
      throw new Error(error.message);
    });

  if (output === undefined) {
    throw new Error('No Less output.');
  }

  const { css, map } = output;

  return {
    css: css.replace(/\/\*# sourceMapping.*$/mv, empty),
    sourceMap: map ? JSON.parse(map) : undefined,
    classOffsets: extractClassOffsetsFromCss(css, { filename, less: true }),
  };
}
