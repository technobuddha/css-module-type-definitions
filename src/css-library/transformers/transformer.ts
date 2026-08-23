import path from 'node:path';

import { type Logger, type Options } from '../../common/index.ts';

import { type CssImporter } from '../css-importer/index.ts';
import { type RawSourceMap } from '../source-map.ts';

import { transformLess } from './transform-less.ts';
import { transformSass } from './transform-sass.ts';

export type TransformerReturn = {
  readonly css: string;
  readonly importedFiles: Set<string>;
  readonly sourceMap?: RawSourceMap;
};

export type TransformerArguments = {
  readonly filename: string;
  readonly directory: string;
  readonly options: Options;
  readonly logger: Logger;
  readonly cssImporter?: CssImporter;
};

export async function transformer(
  css: string,
  args: TransformerArguments,
): Promise<TransformerReturn> {
  const { filename } = args;
  const { ext } = path.parse(filename);

  switch (ext) {
    case '.less': {
      return transformLess(css, args);
    }

    case '.sass': {
      return transformSass(css, args);
    }

    case '.scss': {
      return transformSass(css, args);
    }

    default: {
      return { css, importedFiles: new Set() };
    }
  }
}
