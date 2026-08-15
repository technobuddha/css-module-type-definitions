import path from 'node:path';

import less from 'less';

import { removeInlineSourceMap } from '../../common/index.ts';

import { fixSourceMap } from '../source-map.ts';

import { getSource } from './get-source.ts';
import { type TransformerArguments, type TransformerReturn } from './transformer.ts';

export async function transformLess(
  source: string,
  { filename, directory, options, cssImporter, logger }: TransformerArguments,
): Promise<TransformerReturn> {
  const additionalData = options.css.preprocessor?.less?.additionalData;

  return getSource({ source, filename, additionalData }).then(async ({ content }) =>
    less
      .render(content, {
        filename: path.basename(filename),
        paths: [directory],
        sourceMap: {},
        ...options,
        plugins: [
          ...(cssImporter?.less ? [cssImporter.less] : []),
          ...(options.css.preprocessor?.less?.plugins ?? []),
        ],
      })
      .then(({ css, map, imports }) => {
        const sourceMap = map ? JSON.parse(map) : undefined;

        return {
          css: removeInlineSourceMap(css),
          sourceMap: fixSourceMap(sourceMap, { directory, relativeTo: 'directory', logger }),
          includedFiles: new Set(imports),
        };
      })
      .catch((error: Less.RenderError) => {
        throw new Error(error.message);
      }),
  );
}
