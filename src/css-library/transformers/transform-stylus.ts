// TODO stylus is fucked beyond belief.

import { toError } from '@technobuddha/library';
import stylus from 'stylus';

import { fixSourceMap, type RawSourceMap } from '../source-map.ts';

import { getSource } from './get-source.ts';
import { type TransformerArguments, type TransformerReturn } from './transformer.ts';

let queue: Promise<void> = Promise.resolve();

export async function transformStylus(
  source: string,
  args: TransformerArguments,
): Promise<TransformerReturn> {
  const result = queue.then(async () => txStylus(source, args));

  queue = result.then(() => undefined).catch(() => undefined);
  return result;
}

async function txStylus(
  source: string,
  { options, filename, directory, logger }: TransformerArguments,
): Promise<TransformerReturn> {
  try {
    const { additionalData, ...stylusOptions } =
      options.css.preprocessor?.styl ?? options.css.preprocessor?.stylus ?? {};

    return await getSource({ source, filename, additionalData }).then(
      async ({ content }) =>
        new Promise<TransformerReturn>((resolve, reject) => {
          const styl = stylus(content, { ...stylusOptions, Evaluator: stylus.Evaluator })
            .set('paths', [directory])
            .set('filename', filename)
            .set('sourcemap', { comment: false });

          styl.render((err, css, _js) => {
            if (err) {
              reject(err);
              return;
            }

            const sourceMap = fixSourceMap(
              (styl as unknown as { sourcemap: RawSourceMap }).sourcemap,
              { directory, relativeTo: 'home', logger },
            );
            resolve({
              css,
              includedFiles: new Set(styl.deps()),
              sourceMap,
            });
          });
        }),
    );
  } catch (error) {
    logger.error(toError(error));
    // eslint-disable-next-line no-debugger
    debugger;
    throw error;
  }
}
