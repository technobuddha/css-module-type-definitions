import path from 'node:path';

import { empty } from '@technobuddha/library';
import { compileStringAsync } from 'sass';

import { fixSourceMap } from '../source-map.ts';

import { getSource } from './get-source.ts';
import { type TransformerArguments, type TransformerReturn } from './transformer.ts';

export async function transformSass(
  source: string,
  { filename, directory, options, cssImporter, logger }: TransformerArguments,
): Promise<TransformerReturn> {
  const ext = path.parse(filename).ext.replace(/^\./v, empty) as 'scss' | 'sass';
  const { additionalData, ...sassOptions } = options.preprocessor?.[ext] ?? {};

  return getSource({ source, filename, additionalData }).then(async ({ content }) =>
    compileStringAsync(content, {
      ...sassOptions,
      sourceMap: true,
      loadPaths: [directory],
      style: 'expanded',
      syntax: ext === 'sass' ? 'indented' : 'scss',
      url: URL.parse(filename)!,
      importers: cssImporter ? cssImporter.sass : undefined,
    }).then(({ css, sourceMap, loadedUrls }) => ({
      css,
      sourceMap: fixSourceMap(sourceMap, { directory, relativeTo: 'uri', filename, logger }),
      includedFiles: new Set(
        loadedUrls.map((url) => url.pathname).filter((pathname) => pathname !== filename),
      ),
    })),
  );
}
