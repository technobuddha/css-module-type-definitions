import { type RawSourceMap } from 'source-map-js';
import stylus from 'stylus';

import { fixSourceMap } from '../source-map.ts';

import { getSource } from './get-source.ts';
import { type TransformerArguments, type TransformerReturn } from './transformer.ts';

export async function transformStylus(
  source: string,
  { options, filename, directory }: TransformerArguments,
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

          const sourceMap = fixSourceMap(
            (styl as unknown as { sourcemap: RawSourceMap }).sourcemap,
            { directory, relativeTo: 'home' },
          );
          resolve({
            css,
            includedFiles: new Set(styl.deps()),
            sourceMap,
          });
        });
      }),
  );
}
