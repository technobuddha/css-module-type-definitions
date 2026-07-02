import path from 'node:path';

import less from 'less';

import { removeInlineSourceMap } from '../../common/index.ts';

import { fixSourceMap } from '../source-map.ts';

import { getSource } from './get-source.ts';
import { type TransformerArguments, type TransformerReturn } from './transformer.ts';

export async function transformLess(
  source: string,
  { filename, directory, options }: TransformerArguments,
): Promise<TransformerReturn> {
  const additionalData = options.preprocessor?.less?.additionalData;
  // TODO sourceMap with additionalData

  return getSource({ source, filename, additionalData }).then(async ({ content }) =>
    less
      .render(content, {
        filename: path.basename(filename),
        paths: [directory],
        sourceMap: {},
        ...options,
      })
      .then(({ css, map }) => {
        const sourceMap = map ? JSON.parse(map) : undefined;

        return {
          css: removeInlineSourceMap(css),
          sourceMap: fixSourceMap(sourceMap, { directory, relativeTo: 'directory' }),
        };
      })
      .catch((error: Less.RenderError) => {
        throw new Error(error.message);
      }),
  );
}
