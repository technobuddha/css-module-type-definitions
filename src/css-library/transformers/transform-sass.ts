import path from 'node:path';

import { empty } from '@technobuddha/library';
import { compileStringAsync } from 'sass';
import { URI } from 'vscode-uri';

import { getSource } from './get-source.ts';
import { type TransformerArguments, type TransformerReturn } from './transformer.ts';

export async function transformSass(
  source: string,
  { filename, directory, options }: TransformerArguments,
): Promise<TransformerReturn> {
  const ext = path.parse(filename).ext.replace(/^\./v, empty) as 'scss' | 'sass';
  const { additionalData, ...sassOptions } = options.preprocessor?.[ext] ?? {};

  return getSource({ source, filename, additionalData }).then(async ({ content }) =>
    compileStringAsync(content, {
      sourceMap: true,
      loadPaths: [directory],
      style: 'expanded',
      syntax: ext === 'sass' ? 'indented' : 'scss',
      url: URL.parse(filename)!,
      ...sassOptions,
    }).then(({ css, sourceMap, loadedUrls }) => {
      if (sourceMap) {
        if (sourceMap.file) {
          sourceMap.file = path.relative(directory, URI.parse(sourceMap.file).fsPath);
        }

        for (let i = 0; i < sourceMap.sources.length; i++) {
          sourceMap.sources[i] = path.relative(directory, URI.parse(sourceMap.sources[i]).fsPath);
        }
      }

      return {
        css,
        sourceMap,
        includedFiles: new Set(
          loadedUrls.map((url) => url.pathname).filter((pathname) => pathname !== filename),
        ),
      };
    }),
  );
}
