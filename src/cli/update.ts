import fs from 'node:fs/promises';

import { type Ignore } from 'ignore';

import { type Logger, type Options } from '../common/index.ts';
import { generateTypesFromCss } from '../css-library/generate-types-from-css.ts';

import { findUnignoredFiles } from './find-unignored-files.ts';

type UpdateOptions = {
  options: Options;
  logger: Logger;
  ig: Ignore;
};

export async function update(glob: string, { options, logger, ig }: UpdateOptions): Promise<void> {
  return findUnignoredFiles(glob, ig).then(async (files) =>
    Promise.all(
      files.map(async (file) =>
        fs
          .readFile(file, 'utf-8')
          .then(async (content) => generateTypesFromCss(content, file, { options, logger })),
      ),
    ).then(() => undefined),
  );
}
