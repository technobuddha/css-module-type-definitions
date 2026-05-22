import { type RawSourceMap } from 'source-map-js';
import stylus from 'stylus';

import { type Logger } from '../../common/logger.ts';
import { type Options } from '../../common/options.ts';

import { getSource } from './get-source.ts';
import { type TransformerReturn } from './transformer-return.ts';

type TransformStylusArguments = {
  filename: string;
  options: Options;
  logger: Logger;
};

export async function transformStylus(
  source: string,
  { options, filename }: TransformStylusArguments,
): Promise<TransformerReturn> {
  const { additionalData, ...stylusOptions } =
    options.preprocessor?.styl ?? options.preprocessor?.stylus ?? {};

  return getSource({ source, filename, additionalData }).then(
    async ({ content }) =>
      new Promise<TransformerReturn>((resolve, reject) => {
        const styl = stylus(content, stylusOptions)
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
          });
        });
      }),
  );
}
