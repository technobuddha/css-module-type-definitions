import { type RawSourceMap } from 'source-map-js';
import stylus, { type RenderOptions } from 'stylus';

import { extractClassOffsetsFromCss } from './extract-class-offsets-from-css.ts';
import { type TransformerReturn } from './transformer-return.ts';

type TransformStylusArguments = {
  filename: string;
  options?: RenderOptions;
};

export function transformStylus(
  css: string,
  { options = {}, filename }: TransformStylusArguments,
): TransformerReturn {
  const style = stylus(css, options).set('filename', filename).set('sourcemap', { comment: false });

  const rendered = style.render();

  return {
    css: rendered,
    sourceMap: (style as unknown as { sourcemap: RawSourceMap }).sourcemap,
    classOffsets: extractClassOffsetsFromCss(rendered, { filename }),
  };
}
