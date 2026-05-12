import { type RawSourceMap } from 'source-map-js';
import stylus from 'stylus';

import { type Options } from '../../common/options.ts';

import { type Logger } from '../../common/logger.ts';

import { extractClassOffsetsFromCss } from './extract-class-offsets-from-css.ts';
import { getSource } from './get-source.ts';
import { type TransformerReturn } from './transformer-return.ts';

type TransformStylusArguments = {
  filename: string;
  options?: NonNullable<Options['preprocessor']>['sass'];
  logger?: Logger;
};

export async function transformStylus(
  source: string,
  { options = {}, filename }: TransformStylusArguments,
): Promise<TransformerReturn> {
  const { additionalData } = options;

  return getSource({ source, filename, additionalData }).then(
    async ({ content }) =>
      new Promise<TransformerReturn>((resolve, reject) => {
        const styl = stylus(content, options)
          .set('filename', filename)
          .set('sourcemap', { comment: false });

        styl.render((err, css, _js) => {
          if (err) {
            reject(err);
            return;
          }

          resolve({
            css,
            sourceMap: (styl as unknown as { sourcemap: RawSourceMap }).sourcemap,
            classOffsets: extractClassOffsetsFromCss(css, { filename }),
          });
        });
      }),
  );
}
