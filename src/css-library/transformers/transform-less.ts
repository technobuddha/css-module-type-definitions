import path from 'node:path';

import less from 'less';

import { type RawSourceMap, removeInlineSourceMap } from '../source-map.ts';

import { getSource } from './get-source.ts';
import { type TransformerArguments, type TransformerReturn } from './transformer.ts';

export async function transformLess(
  source: string,
  { filename, directory, options, cssImporter }: TransformerArguments,
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
          sourceMap: fixLessSourceMap(sourceMap, directory),
          importedFiles: new Set(imports),
        };
      })
      .catch((error: Less.RenderError) => {
        throw new Error(error.message);
      }),
  );
}

export function fixLessSourceMap(
  sourceMap: RawSourceMap | undefined,
  directory: string,
): RawSourceMap | undefined {
  if (sourceMap) {
    if (sourceMap.file) {
      sourceMap.file = path.relative(directory, path.resolve(directory, sourceMap.file));
    }
    for (let i = 0; i < sourceMap.sources.length; i++) {
      sourceMap.sources[i] = path.relative(
        directory,
        path.resolve(directory, sourceMap.sources[i]),
      );
    }
  }
  return sourceMap;
}
