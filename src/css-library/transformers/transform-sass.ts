import path from 'node:path';

import { empty } from '@technobuddha/library';
import { compileStringAsync } from 'sass';
import { URI } from 'vscode-uri';

import { type RawSourceMap } from '../source-map.ts';

import { getSource } from './get-source.ts';
import { type TransformerArguments, type TransformerReturn } from './transformer.ts';

export async function transformSass(
  source: string,
  { filename, directory, options, cssImporter }: TransformerArguments,
): Promise<TransformerReturn> {
  const ext = path.parse(filename).ext.replace(/^\./v, empty) as 'scss' | 'sass';
  const { additionalData, ...sassOptions } = options.css.preprocessor?.[ext] ?? {};

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
      sourceMap: fixSassSourceMap(sourceMap, directory, filename),
      includedFiles: new Set(
        loadedUrls.map((url) => url.pathname).filter((pathname) => pathname !== filename),
      ),
    })),
  );
}

export function fixSassSourceMap(
  sourceMap: RawSourceMap | undefined,
  directory: string,
  filename: string,
): RawSourceMap | undefined {
  if (sourceMap) {
    if (sourceMap.file) {
      sourceMap.file = fixSource(sourceMap.file, directory, filename);
    }
    for (let i = 0; i < sourceMap.sources.length; i++) {
      sourceMap.sources[i] = fixSource(sourceMap.sources[i], directory, filename);
    }
  }
  return sourceMap;
}

function fixSource(pathname: string, directory: string, filename: string): string {
  return path.relative(
    directory,
    pathname.startsWith('data:') ? filename : URI.parse(pathname).fsPath,
  );
}
